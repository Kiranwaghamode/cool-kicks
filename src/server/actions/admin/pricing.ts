"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { audit } from "@/server/audit";
import { Prisma } from "@/generated/prisma/client";

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

function refresh() {
  revalidatePath("/admin/pricing");
  revalidatePath("/business", "layout");
}

const nameField = z.string().trim().min(2, "Enter a name").max(60);

// ───────────────────────── Price lists ─────────────────────────

const priceListSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  description: z.string().trim().max(200).optional().default(""),
  discountBps: z.number().int().min(0).max(9000, "Discount can't exceed 90%"),
  isActive: z.boolean(),
});

export async function savePriceList(input: z.input<typeof priceListSchema>) {
  return adminAction("pricing", async (staff) => {
    const parsed = priceListSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const p = parsed.data;
    const data = { name: p.name, description: p.description || null, discountBps: p.discountBps, isActive: p.isActive };
    try {
      const row = p.id ? await db.priceList.update({ where: { id: p.id }, data }) : await db.priceList.create({ data });
      await audit({ staffId: staff.id }, { action: "pricelist.save", entityType: "PriceList", entityId: row.id, summary: `${p.id ? "Updated" : "Created"} price list ${p.name} (${p.discountBps / 100}% off)` });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "A price list with that name exists.", fieldErrors: { name: "Already exists" } };
      throw e;
    }
    refresh();
    return { ok: true, message: p.id ? "Price list updated" : "Price list created" };
  });
}

const itemsSchema = z.object({
  priceListId: z.string().min(1),
  items: z
    .array(z.object({ variantId: z.string().min(1), price: z.number().int().min(1).max(100_000_000).nullable() }))
    .max(500),
});

/** Set or clear per-variant price overrides for a list (null = use the list's % discount). */
export async function savePriceListItems(input: z.input<typeof itemsSchema>) {
  return adminAction("pricing", async (staff) => {
    const parsed = itemsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Prices must be positive amounts." };
    const { priceListId, items } = parsed.data;
    const list = await db.priceList.findUnique({ where: { id: priceListId }, select: { name: true } });
    if (!list) return { ok: false, error: "Price list not found" };
    await db.$transaction(async (tx) => {
      for (const i of items) {
        if (i.price === null) await tx.priceListItem.deleteMany({ where: { priceListId, variantId: i.variantId } });
        else
          await tx.priceListItem.upsert({
            where: { priceListId_variantId: { priceListId, variantId: i.variantId } },
            update: { price: i.price },
            create: { priceListId, variantId: i.variantId, price: i.price },
          });
      }
      await audit({ staffId: staff.id }, { action: "pricelist.items", entityType: "PriceList", entityId: priceListId, summary: `Updated product prices in ${list.name}` }, tx);
    });
    refresh();
    return { ok: true, message: "Prices saved" };
  });
}

// ───────────────────────── Customer groups ─────────────────────────

const groupSchema = z.object({
  id: z.string().optional(),
  name: nameField,
  description: z.string().trim().max(200).optional().default(""),
  priceListId: z.string().max(40).optional().default(""),
  isActive: z.boolean(),
});

export async function saveCustomerGroup(input: z.input<typeof groupSchema>) {
  return adminAction("pricing", async (staff) => {
    const parsed = groupSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const g = parsed.data;
    const data = { name: g.name, description: g.description || null, priceListId: g.priceListId || null, isActive: g.isActive };
    try {
      const row = g.id ? await db.customerGroup.update({ where: { id: g.id }, data }) : await db.customerGroup.create({ data });
      await audit({ staffId: staff.id }, { action: "group.save", entityType: "CustomerGroup", entityId: row.id, summary: `${g.id ? "Updated" : "Created"} customer group ${g.name}` });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "A group with that name exists.", fieldErrors: { name: "Already exists" } };
      throw e;
    }
    refresh();
    return { ok: true, message: g.id ? "Group updated" : "Group created" };
  });
}
