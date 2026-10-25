"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { parseISTDate, addDays } from "@/lib/dates";
import { WEEKDAYS } from "@/lib/shop-hours";

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}
const paise = z.number().int().min(0).max(100_000_000);

// ───────────────────────── Coupons ─────────────────────────

const couponSchema = z
  .object({
    id: z.string().optional(),
    code: z.string().trim().toUpperCase().min(3, "At least 3 characters").max(20).regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
    description: z.string().trim().max(120).optional().default(""),
    type: z.enum(["PERCENT", "FLAT", "BUY_X_GET_Y"]),
    value: z.number().int().min(0).max(100_000_000),
    minOrderAmount: paise,
    maxDiscount: paise.nullable(),
    buyQuantity: z.number().int().min(1).max(20).nullable(),
    getQuantity: z.number().int().min(1).max(20).nullable(),
    validFrom: z.string(),
    validTo: z.string(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable(),
    isActive: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "PERCENT" && (c.value < 1 || c.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percent must be 1–100" });
    if (c.type === "FLAT" && c.value < 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the amount off" });
    if (c.type === "BUY_X_GET_Y" && (!c.buyQuantity || !c.getQuantity)) ctx.addIssue({ code: "custom", path: ["buyQuantity"], message: "Set buy and get quantities" });
    const f = parseISTDate(c.validFrom);
    const t = parseISTDate(c.validTo);
    if (!f) ctx.addIssue({ code: "custom", path: ["validFrom"], message: "Pick a start date" });
    if (!t) ctx.addIssue({ code: "custom", path: ["validTo"], message: "Pick an end date" });
    if (f && t && t < f) ctx.addIssue({ code: "custom", path: ["validTo"], message: "End date is before start date" });
  });

export type CouponInput = z.input<typeof couponSchema>;

export async function saveCoupon(input: CouponInput) {
  return adminAction("coupons", async () => {
    const parsed = couponSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const c = parsed.data;
    const clash = await db.coupon.findFirst({ where: { code: c.code, ...(c.id ? { id: { not: c.id } } : {}) } });
    if (clash) return { ok: false, error: "That code already exists.", fieldErrors: { code: "Already exists" } };
    const data = {
      code: c.code,
      description: c.description || null,
      type: c.type,
      value: c.type === "BUY_X_GET_Y" ? 0 : c.value,
      minOrderAmount: c.minOrderAmount,
      maxDiscount: c.type === "BUY_X_GET_Y" || c.type === "PERCENT" ? c.maxDiscount : null,
      buyQuantity: c.type === "BUY_X_GET_Y" ? c.buyQuantity : null,
      getQuantity: c.type === "BUY_X_GET_Y" ? c.getQuantity : null,
      validFrom: parseISTDate(c.validFrom)!,
      // valid through the end of the chosen day
      validTo: new Date(addDays(parseISTDate(c.validTo)!, 1).getTime() - 1),
      usageLimit: c.usageLimit,
      isActive: c.isActive,
    };
    if (c.id) await db.coupon.update({ where: { id: c.id }, data });
    else await db.coupon.create({ data });
    revalidatePath("/", "layout");
    return { ok: true, message: c.id ? "Coupon updated" : "Coupon created" };
  });
}

export async function setCouponActive(id: string, active: boolean) {
  return adminAction("coupons", async () => {
    await db.coupon.update({ where: { id }, data: { isActive: active } });
    revalidatePath("/", "layout");
    return { ok: true, message: active ? "Coupon activated" : "Coupon deactivated" };
  });
}

// ───────────────────────── Delivery zones ─────────────────────────

const zoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  pincodes: z.array(z.string().regex(/^[1-9]\d{5}$/, "Pincodes are 6 digits")).min(1, "Add at least one pincode").max(200),
  deliveryFee: paise,
  freeDeliveryAbove: paise.nullable(),
  isActive: z.boolean(),
});

export type ZoneInput = z.input<typeof zoneSchema>;

export async function saveZone(input: ZoneInput) {
  return adminAction("deliveryZones", async () => {
    const parsed = zoneSchema.safeParse({ ...input, pincodes: [...new Set(input.pincodes)] });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form", fieldErrors: fieldErrors(parsed.error) };
    const z2 = parsed.data;
    // A pincode may belong to only one active zone.
    if (z2.isActive) {
      const others = await db.deliveryZone.findMany({ where: { isActive: true, ...(z2.id ? { id: { not: z2.id } } : {}) }, select: { name: true, pincodes: true } });
      for (const o of others) {
        const dup = o.pincodes.find((p) => z2.pincodes.includes(p));
        if (dup) return { ok: false, error: `${dup} is already in the “${o.name}” zone.`, fieldErrors: { pincodes: `${dup} is in another zone` } };
      }
    }
    const data = { name: z2.name, pincodes: z2.pincodes, deliveryFee: z2.deliveryFee, freeDeliveryAbove: z2.freeDeliveryAbove, isActive: z2.isActive };
    if (z2.id) await db.deliveryZone.update({ where: { id: z2.id }, data });
    else await db.deliveryZone.create({ data });
    revalidatePath("/admin/delivery-zones");
    return { ok: true, message: z2.id ? "Zone updated" : "Zone created" };
  });
}

export async function setZoneActive(id: string, active: boolean) {
  return adminAction("deliveryZones", async () => {
    await db.deliveryZone.update({ where: { id }, data: { isActive: active } });
    revalidatePath("/admin/delivery-zones");
    return { ok: true, message: active ? "Zone active" : "Zone paused" };
  });
}

// ───────────────────────── Reviews & messages ─────────────────────────

export async function setReviewApproved(id: string, approved: boolean) {
  return adminAction("reviews", async () => {
    await db.review.update({ where: { id }, data: { isApproved: approved } });
    revalidatePath("/", "layout");
    return { ok: true, message: approved ? "Review is now visible" : "Review hidden" };
  });
}

export async function deleteReview(id: string) {
  return adminAction("reviews", async () => {
    await db.review.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Review deleted" };
  });
}

export async function setMessageRead(id: string, read: boolean) {
  return adminAction("messages", async () => {
    await db.contactMessage.update({ where: { id }, data: { isRead: read } });
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function deleteMessage(id: string) {
  return adminAction("messages", async () => {
    await db.contactMessage.delete({ where: { id } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Message deleted" };
  });
}

// ───────────────────────── Shop settings ─────────────────────────

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const settingsSchema = z.object({
  shopName: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().min(10, "Enter a phone number").max(16),
  whatsappNumber: z.string().trim().regex(/^\d{10,15}$/, "Digits only, with country code (e.g. 919876543210)"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional().default(""),
  address: z.string().trim().min(5, "Enter the shop address").max(300),
  mapEmbedUrl: z.union([z.string().trim().url("Paste the full https:// link").startsWith("https://"), z.literal("")]).optional().default(""),
  mapLink: z.union([z.string().trim().url("Paste the full https:// link").startsWith("https://"), z.literal("")]).optional().default(""),
  instagramUrl: z.union([z.string().trim().url(), z.literal("")]).optional().default(""),
  facebookUrl: z.union([z.string().trim().url(), z.literal("")]).optional().default(""),
  openingHours: z.object(Object.fromEntries(WEEKDAYS.map((d) => [d, z.object({ open: time, close: time, closed: z.boolean() })])) as Record<(typeof WEEKDAYS)[number], z.ZodObject<{ open: typeof time; close: typeof time; closed: z.ZodBoolean }>>),
  isTemporarilyClosed: z.boolean(),
  closureMessage: z.string().trim().max(200).optional().default(""),
  minOrderAmount: paise,
  estimatedPrepMins: z.number().int().min(5).max(180),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  codEnabled: z.boolean(),
  payAtShopEnabled: z.boolean(),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(input: SettingsInput) {
  return adminAction("settings", async () => {
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const s = parsed.data;
    if (!s.pickupEnabled && !s.deliveryEnabled) return { ok: false, error: "Enable pickup, delivery or both." };
    await db.shopSettings.update({
      where: { id: 1 },
      data: {
        ...s,
        tagline: s.tagline || null,
        email: s.email || null,
        mapEmbedUrl: s.mapEmbedUrl || null,
        mapLink: s.mapLink || null,
        instagramUrl: s.instagramUrl || null,
        facebookUrl: s.facebookUrl || null,
        closureMessage: s.closureMessage || null,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved" };
  });
}
