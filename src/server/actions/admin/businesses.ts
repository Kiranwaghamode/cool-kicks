"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { audit } from "@/server/audit";
import { gstinProblem, isValidPan, isValidStateCode, normalizeGstin } from "@/lib/gst";
import { indianMobile } from "@/lib/validation";
import { BUSINESS_STATUS_LABELS, BUSINESS_TYPES } from "@/lib/types";
import { Prisma } from "@/generated/prisma/client";

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

function refresh(id?: string) {
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/businesses/${id}`);
  revalidatePath("/business", "layout");
}

// ───────────────────────── Approval ─────────────────────────

const ALLOWED: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
  REJECTED: ["APPROVED"],
};

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
  note: z.string().trim().max(300).optional().default(""),
  groupId: z.string().max(40).optional().default(""),
});

/** Approve, reject, suspend or reactivate a business account. */
export async function setBusinessStatus(input: z.input<typeof statusSchema>) {
  return adminAction("businesses", async (staff) => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };
    const { id, status, note, groupId } = parsed.data;
    if (status !== "APPROVED" && note.length < 3) return { ok: false, error: "Please give a reason – the business will see it." };

    const b = await db.business.findUnique({ where: { id }, select: { status: true, legalName: true, type: true, groupId: true } });
    if (!b) return { ok: false, error: "Business not found" };
    if (!ALLOWED[b.status]?.includes(status))
      return { ok: false, error: `Can't change a business from “${BUSINESS_STATUS_LABELS[b.status]}” to “${BUSINESS_STATUS_LABELS[status]}”.` };

    let group = groupId || b.groupId;
    if (status === "APPROVED" && !group) {
      // Default group: the active group named after the business type (seeded as "Retailers" / "Distributors").
      const g = await db.customerGroup.findFirst({
        where: { isActive: true, name: { startsWith: b.type === "RETAILER" ? "Retail" : "Distribut", mode: "insensitive" } },
        select: { id: true },
      });
      group = g?.id ?? null;
    }
    if (group && !(await db.customerGroup.findFirst({ where: { id: group }, select: { id: true } }))) return { ok: false, error: "Customer group not found" };

    await db.$transaction(async (tx) => {
      const updated = await tx.business.updateMany({
        where: { id, status: b.status },
        data: {
          status,
          statusNote: status === "APPROVED" ? null : note,
          groupId: group,
          ...(status === "APPROVED" ? { approvedAt: new Date(), approvedById: staff.id } : {}),
        },
      });
      if (updated.count === 0) throw new Error("conflict");
      const verb = { APPROVED: b.status === "PENDING" ? "Approved" : "Reactivated", REJECTED: "Rejected", SUSPENDED: "Suspended" }[status];
      await audit(
        { staffId: staff.id },
        { action: `business.${status.toLowerCase()}`, entityType: "Business", entityId: id, summary: `${verb} ${b.legalName}${note ? ` – ${note}` : ""}` },
        tx,
      );
    });
    refresh(id);
    return { ok: true, message: `${b.legalName} is now ${BUSINESS_STATUS_LABELS[status].toLowerCase()}` };
  });
}

// ───────────────────────── Edit details ─────────────────────────

const updateSchema = z
  .object({
    id: z.string().min(1),
    legalName: z.string().trim().min(2).max(120),
    tradeName: z.string().trim().max(120).optional().default(""),
    type: z.enum(BUSINESS_TYPES),
    contactName: z.string().trim().min(2).max(60),
    phone: indianMobile,
    email: z.union([z.string().trim().toLowerCase().email("Enter a valid email"), z.literal("")]).optional().default(""),
    gstin: z.string().trim().transform(normalizeGstin).optional().default(""),
    pan: z.string().trim().toUpperCase().optional().default(""),
    stateCode: z.string().refine(isValidStateCode, "Choose a state"),
    groupId: z.string().max(40).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.gstin) {
      const p = gstinProblem(v.gstin);
      if (p) ctx.addIssue({ code: "custom", path: ["gstin"], message: p });
      else if (v.gstin.slice(0, 2) !== v.stateCode) ctx.addIssue({ code: "custom", path: ["stateCode"], message: "State must match the GSTIN" });
    }
    if (v.pan && !isValidPan(v.pan)) ctx.addIssue({ code: "custom", path: ["pan"], message: "PAN should look like ABCDE1234F" });
  });

export type BusinessUpdateInput = z.input<typeof updateSchema>;

export async function updateBusiness(input: BusinessUpdateInput) {
  return adminAction("businesses", async (staff) => {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const v = parsed.data;
    try {
      await db.business.update({
        where: { id: v.id },
        data: {
          legalName: v.legalName,
          tradeName: v.tradeName || null,
          type: v.type,
          contactName: v.contactName,
          phone: v.phone,
          email: v.email || null,
          gstin: v.gstin || null,
          pan: v.pan || (v.gstin ? v.gstin.slice(2, 12) : null),
          stateCode: v.stateCode,
          groupId: v.groupId || null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        return { ok: false, error: "Another business already uses this phone number or GSTIN." };
      throw e;
    }
    await audit({ staffId: staff.id }, { action: "business.update", entityType: "Business", entityId: v.id, summary: `Updated details of ${v.legalName}` });
    refresh(v.id);
    return { ok: true, message: "Business details saved" };
  });
}

/** Generate a temporary password (there's no SMS reset yet). Shown once to staff. */
export async function resetBusinessPassword(id: string) {
  return adminAction<{ password: string }>("businesses", async (staff) => {
    const b = await db.business.findUnique({ where: { id }, select: { legalName: true } });
    if (!b) return { ok: false, error: "Business not found" };
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    const temp = `${Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("")}${randomInt(10, 99)}`;
    await db.$transaction([
      db.business.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temp, 12) } }),
      db.businessSession.deleteMany({ where: { businessId: id } }),
    ]);
    await audit({ staffId: staff.id }, { action: "business.password.reset", entityType: "Business", entityId: id, summary: `Reset the password of ${b.legalName}` });
    return { ok: true, message: "Temporary password created", data: { password: temp } };
  });
}

// ───────────────────────── Documents ─────────────────────────

const reviewSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["VERIFIED", "REJECTED"]),
  note: z.string().trim().max(200).optional().default(""),
});

export async function reviewDocument(input: z.input<typeof reviewSchema>) {
  return adminAction("businesses", async (staff) => {
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };
    const { id, status, note } = parsed.data;
    if (status === "REJECTED" && note.length < 3) return { ok: false, error: "Tell the business why the document was rejected." };
    const doc = await db.businessDocument.findUnique({ where: { id }, select: { businessId: true, type: true, fileName: true } });
    if (!doc) return { ok: false, error: "Document not found" };
    await db.businessDocument.update({ where: { id }, data: { status, note: note || null, reviewedById: staff.id, reviewedAt: new Date() } });
    await audit(
      { staffId: staff.id },
      { action: `document.${status.toLowerCase()}`, entityType: "Business", entityId: doc.businessId, summary: `${status === "VERIFIED" ? "Verified" : "Rejected"} ${doc.fileName}` },
    );
    refresh(doc.businessId);
    return { ok: true, message: status === "VERIFIED" ? "Document verified" : "Document rejected" };
  });
}

// ───────────────────────── Credit terms ─────────────────────────

const creditSchema = z.object({
  businessId: z.string().min(1),
  isActive: z.boolean(),
  creditLimit: z.number().int().min(0).max(1_000_000_000),
  creditDays: z.number().int().min(0).max(180),
  note: z.string().trim().max(300).optional().default(""),
});

export async function saveCreditAccount(input: z.input<typeof creditSchema>) {
  return adminAction("credit", async (staff) => {
    const parsed = creditSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const c = parsed.data;
    const b = await db.business.findUnique({ where: { id: c.businessId }, select: { legalName: true, credit: true } });
    if (!b) return { ok: false, error: "Business not found" };
    const data = { isActive: c.isActive, creditLimit: c.creditLimit, creditDays: c.creditDays, note: c.note || null };
    await db.$transaction(async (tx) => {
      await tx.creditAccount.upsert({ where: { businessId: c.businessId }, update: data, create: { businessId: c.businessId, ...data } });
      await audit(
        { staffId: staff.id },
        {
          action: "credit.update",
          entityType: "Business",
          entityId: c.businessId,
          summary: `Credit ${c.isActive ? "on" : "off"} · limit ₹${(c.creditLimit / 100).toLocaleString("en-IN")} · ${c.creditDays} days`,
          meta: { before: b.credit ? { isActive: b.credit.isActive, creditLimit: b.credit.creditLimit, creditDays: b.credit.creditDays } : null, after: data },
        },
        tx,
      );
    });
    refresh(c.businessId);
    return { ok: true, message: "Credit terms saved" };
  });
}

// ───────────────────────── Customer-specific prices ─────────────────────────

const customerPriceSchema = z.object({
  businessId: z.string().min(1),
  variantId: z.string().min(1),
  price: z.number().int().min(1, "Enter a price").max(100_000_000),
  validTo: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().default(""),
});

export async function saveCustomerPrice(input: z.input<typeof customerPriceSchema>) {
  return adminAction("pricing", async (staff) => {
    const parsed = customerPriceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const p = parsed.data;
    const variant = await db.productVariant.findUnique({ where: { id: p.variantId }, select: { size: true, product: { select: { name: true } } } });
    if (!variant) return { ok: false, error: "Product not found" };
    // Valid through the end of the chosen day (IST).
    const validTo = p.validTo ? new Date(new Date(`${p.validTo}T23:59:59.999+05:30`).getTime()) : null;
    await db.customerPrice.upsert({
      where: { businessId_variantId: { businessId: p.businessId, variantId: p.variantId } },
      update: { price: p.price, validTo },
      create: { businessId: p.businessId, variantId: p.variantId, price: p.price, validTo },
    });
    await audit(
      { staffId: staff.id },
      { action: "price.customer", entityType: "Business", entityId: p.businessId, summary: `Special price ${variant.product.name} ${variant.size.toLowerCase()}: ₹${(p.price / 100).toFixed(2)}` },
    );
    refresh(p.businessId);
    return { ok: true, message: "Special price saved" };
  });
}

export async function removeCustomerPrice(businessId: string, variantId: string) {
  return adminAction("pricing", async (staff) => {
    await db.customerPrice.deleteMany({ where: { businessId, variantId } });
    await audit({ staffId: staff.id }, { action: "price.customer.remove", entityType: "Business", entityId: businessId, summary: "Removed a special price" });
    refresh(businessId);
    return { ok: true, message: "Special price removed" };
  });
}
