"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  addressSchema,
  businessLoginSchema,
  changePasswordSchema,
  registerBusinessSchema,
} from "@/lib/b2b-validation";
import { stateName } from "@/lib/gst";
import { DOCUMENT_TYPES } from "@/lib/types";
import type { ActionResult } from "@/server/auth-guard";
import {
  businessAction,
  createBusinessSession,
  destroyBusinessSession,
  destroyOtherBusinessSessions,
} from "@/server/business-auth";
import { clientIp, rateLimit, resetRateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { DocumentError, readDocument } from "@/server/documents";

// Same cost as staff passwords. A real hash so unknown phones take as long as wrong passwords.
const BCRYPT_COST = 12;
const DUMMY_HASH = "$2b$12$T5Iq/2qkdkuSn2V6FCBT5eHUirFUACzHyfT6RFhy7d8E6TpsTLMEa";

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

/** Only allow redirects inside the business portal. */
function safeNext(next: unknown) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/business/") && !n.startsWith("//") && !n.includes("\\") ? n : "/business/account";
}

// ───────────────────────── Registration ─────────────────────────

/**
 * Register a retailer / distributor. FormData carries `data` (JSON of the form) and an optional
 * `gstCertificate` file. The account starts PENDING until staff approve it.
 */
export async function registerBusiness(formData: FormData): Promise<ActionResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("data") ?? "{}"));
  } catch {
    return { ok: false, error: "Please refresh the page and try again." };
  }
  const parsed = registerBusinessSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimit(`b2b-register:ip:${ip}`, 5, 60 * 60)))
    return { ok: false, error: "Too many sign-ups from this network. Please try again in an hour or call us." };

  const file = formData.get("gstCertificate");
  let doc: Awaited<ReturnType<typeof readDocument>> | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      doc = await readDocument(file);
    } catch (e) {
      if (e instanceof DocumentError) return { ok: false, error: e.message, fieldErrors: { gstCertificate: e.message } };
      throw e;
    }
  }

  const [phoneTaken, gstinTaken] = await Promise.all([
    db.business.findUnique({ where: { phone: v.phone }, select: { id: true } }),
    v.gstin ? db.business.findUnique({ where: { gstin: v.gstin }, select: { id: true } }) : null,
  ]);
  if (phoneTaken)
    return { ok: false, error: "This mobile number is already registered. Please log in.", fieldErrors: { phone: "Already registered – log in instead" } };
  if (gstinTaken)
    return { ok: false, error: "A business with this GSTIN is already registered.", fieldErrors: { gstin: "Already registered" } };

  const settings = await db.shopSettings.findUnique({ where: { id: 1 }, select: { defaultCreditDays: true } });
  const passwordHash = await bcrypt.hash(v.password, BCRYPT_COST);

  let businessId: string;
  try {
    const created = await db.$transaction(async (tx) => {
      const b = await tx.business.create({
        data: {
          legalName: v.legalName,
          tradeName: v.tradeName || null,
          type: v.type,
          contactName: v.contactName,
          phone: v.phone,
          email: v.email || null,
          passwordHash,
          gstin: v.gstin || null,
          pan: v.pan || (v.gstin ? v.gstin.slice(2, 12) : null),
          stateCode: v.stateCode,
          credit: { create: { isActive: false, creditLimit: 0, creditDays: settings?.defaultCreditDays ?? 15 } },
          addresses: {
            create: {
              label: "Main address",
              contactName: v.contactName,
              phone: v.phone,
              line1: v.address.line1,
              line2: v.address.line2 || null,
              landmark: v.address.landmark || null,
              area: v.address.area,
              city: v.address.city,
              state: stateName(v.stateCode),
              pincode: v.address.pincode,
              isDefault: true,
            },
          },
          ...(doc
            ? { documents: { create: { type: "GST_CERTIFICATE", fileName: doc.fileName, mimeType: doc.mimeType, size: doc.size, data: new Uint8Array(doc.data) } } }
            : {}),
        },
        select: { id: true, legalName: true },
      });
      await audit({ businessId: b.id }, { action: "business.register", entityType: "Business", entityId: b.id, summary: `${b.legalName} registered (${v.type.toLowerCase()})` }, tx);
      return b;
    });
    businessId = created.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "This mobile number or GSTIN is already registered." };
    throw e;
  }

  await createBusinessSession(businessId);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Registration received" };
}

// ───────────────────────── Login / logout ─────────────────────────

export type BusinessLoginState = { error: string; phone: string } | null;

export async function businessLogin(_prev: BusinessLoginState, formData: FormData): Promise<BusinessLoginState> {
  const phoneRaw = String(formData.get("phone") ?? "").slice(0, 20);
  const parsed = businessLoginSchema.safeParse({ phone: phoneRaw, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "Enter your 10-digit mobile number and password.", phone: phoneRaw };
  const { phone, password } = parsed.data;

  const ip = await clientIp();
  const [phoneOk, ipOk] = await Promise.all([
    rateLimit(`b2b-login:phone:${phone}`, 5, 15 * 60),
    rateLimit(`b2b-login:ip:${ip}`, 20, 15 * 60),
  ]);
  if (!phoneOk || !ipOk) return { error: "Too many attempts. Please wait 15 minutes and try again.", phone: phoneRaw };

  const business = await db.business.findUnique({ where: { phone }, select: { id: true, passwordHash: true } });
  const valid = await bcrypt.compare(password, business?.passwordHash ?? DUMMY_HASH);
  if (!business || !valid) return { error: "Incorrect mobile number or password.", phone: phoneRaw };

  await Promise.all([
    resetRateLimit(`b2b-login:phone:${phone}`),
    db.business.update({ where: { id: business.id }, data: { lastLoginAt: new Date() } }),
  ]);
  await createBusinessSession(business.id);
  redirect(safeNext(formData.get("next")));
}

export async function businessLogout() {
  await destroyBusinessSession();
  redirect("/business/login");
}

export async function changeBusinessPassword(input: z.input<typeof changePasswordSchema>) {
  return businessAction({}, async (b) => {
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    if (!(await rateLimit(`b2b-password:${b.id}`, 5, 15 * 60))) return { ok: false, error: "Too many attempts. Please wait 15 minutes." };
    const row = await db.business.findUniqueOrThrow({ where: { id: b.id }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(parsed.data.current, row.passwordHash)))
      return { ok: false, error: "Current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
    await db.business.update({ where: { id: b.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, BCRYPT_COST) } });
    await destroyOtherBusinessSessions(b.id);
    await audit({ businessId: b.id }, { action: "business.password", entityType: "Business", entityId: b.id, summary: "Changed account password" });
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  });
}

// ───────────────────────── Addresses ─────────────────────────

export async function saveBusinessAddress(input: z.input<typeof addressSchema> & { id?: string; isDefault?: boolean }) {
  return businessAction({}, async (b) => {
    const parsed = addressSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const a = parsed.data;
    const data = {
      label: a.label,
      contactName: a.contactName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 || null,
      landmark: a.landmark || null,
      area: a.area,
      city: a.city,
      state: stateName(a.stateCode),
      pincode: a.pincode,
    };
    await db.$transaction(async (tx) => {
      const count = await tx.businessAddress.count({ where: { businessId: b.id, isActive: true } });
      if (!input.id && count >= 20) throw new Error("limit");
      const makeDefault = !!input.isDefault || count === 0;
      if (makeDefault) await tx.businessAddress.updateMany({ where: { businessId: b.id }, data: { isDefault: false } });
      if (input.id) {
        const updated = await tx.businessAddress.updateMany({
          where: { id: input.id, businessId: b.id, isActive: true },
          data: { ...data, ...(makeDefault ? { isDefault: true } : {}) },
        });
        if (updated.count === 0) throw new Error("not found");
      } else {
        await tx.businessAddress.create({ data: { ...data, businessId: b.id, isDefault: makeDefault } });
      }
    });
    revalidatePath("/business", "layout");
    return { ok: true, message: input.id ? "Address updated" : "Address added" };
  });
}

export async function removeBusinessAddress(id: string) {
  return businessAction({}, async (b) => {
    const addr = await db.businessAddress.findFirst({ where: { id, businessId: b.id, isActive: true } });
    if (!addr) return { ok: false, error: "Address not found" };
    // Soft delete: past orders keep their own copy of the address anyway.
    await db.businessAddress.update({ where: { id }, data: { isActive: false, isDefault: false } });
    if (addr.isDefault) {
      const next = await db.businessAddress.findFirst({ where: { businessId: b.id, isActive: true }, orderBy: { createdAt: "asc" } });
      if (next) await db.businessAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    revalidatePath("/business", "layout");
    return { ok: true, message: "Address removed" };
  });
}

// ───────────────────────── Documents ─────────────────────────

export async function uploadBusinessDocument(formData: FormData) {
  return businessAction({}, async (b) => {
    const type = z.enum(DOCUMENT_TYPES).safeParse(formData.get("type"));
    if (!type.success) return { ok: false, error: "Choose the document type." };
    if (!(await rateLimit(`b2b-doc:${b.id}`, 15, 60 * 60))) return { ok: false, error: "Too many uploads. Please try again later." };
    const count = await db.businessDocument.count({ where: { businessId: b.id } });
    if (count >= 15) return { ok: false, error: "You've uploaded the maximum number of documents. Please contact us." };
    try {
      const doc = await readDocument(formData.get("file"));
      await db.businessDocument.create({
        data: { businessId: b.id, type: type.data, fileName: doc.fileName, mimeType: doc.mimeType, size: doc.size, data: new Uint8Array(doc.data) },
      });
    } catch (e) {
      if (e instanceof DocumentError) return { ok: false, error: e.message };
      throw e;
    }
    await audit({ businessId: b.id }, { action: "business.document.upload", entityType: "Business", entityId: b.id, summary: `Uploaded ${type.data.toLowerCase().replace(/_/g, " ")}` });
    revalidatePath("/business", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Document uploaded. We'll review it shortly." };
  });
}
