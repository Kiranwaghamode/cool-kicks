"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { adminAction, requireRoleForAction } from "@/server/auth-guard";
import { addIngredientBatch, reduceIngredient, StockReduceError } from "@/server/ingredient-stock";
import { addDays, parseISTDate, startOfDayIST } from "@/lib/dates";

const UNITS = ["KG", "LITRE", "PIECE", "GRAM", "ML"] as const;

/** Expiry for new stock: a date (YYYY-MM-DD, IST) unless the item doesn't expire. */
const expiryFields = {
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional().default(""),
  noExpiry: z.boolean().optional().default(false),
};

/** Turns the form's expiry into the stored value (end of that IST day) or an error message. */
function parseExpiry(v: { expiresOn: string; noExpiry: boolean }): { ok: true; expiresAt: Date | null } | { ok: false; error: string } {
  if (v.noExpiry) return { ok: true, expiresAt: null };
  if (!v.expiresOn) return { ok: false, error: "Enter the expiry date (or tick “Doesn’t expire”)." };
  const day = parseISTDate(v.expiresOn);
  if (!day) return { ok: false, error: "Pick a valid expiry date." };
  if (day < startOfDayIST()) return { ok: false, error: "That expiry date has already passed." };
  return { ok: true, expiresAt: new Date(addDays(day, 1).getTime() - 1) };
}

function refresh() {
  // Stock changes can make drinks available/unavailable on the shop too.
  revalidatePath("/", "layout");
}

const ingredientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  unit: z.enum(UNITS),
  lowStockThreshold: z.number().min(0).max(1_000_000),
  /** Only used when creating. */
  currentStock: z.number().min(0).max(1_000_000).optional(),
  ...expiryFields,
});

export async function saveIngredient(input: z.input<typeof ingredientSchema>) {
  return adminAction("inventory", async (staff) => {
    const parsed = ingredientSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Please check the form.", fieldErrors: fe };
    }
    const v = parsed.data;
    const clash = await db.ingredient.findFirst({ where: { name: { equals: v.name, mode: "insensitive" }, ...(v.id ? { id: { not: v.id } } : {}) } });
    if (clash) return { ok: false, error: "An ingredient with that name already exists.", fieldErrors: { name: "Already exists" } };
    if (v.id) {
      await db.ingredient.update({ where: { id: v.id }, data: { name: v.name, unit: v.unit, lowStockThreshold: new Prisma.Decimal(v.lowStockThreshold) } });
    } else {
      const start = v.currentStock ?? 0;
      const exp = parseExpiry(v);
      if (!exp.ok) return { ok: false, error: exp.error, fieldErrors: { expiresOn: exp.error } };
      await db.$transaction(async (tx) => {
        const ing = await tx.ingredient.create({
          data: { name: v.name, unit: v.unit, lowStockThreshold: new Prisma.Decimal(v.lowStockThreshold) },
        });
        if (start > 0) await addIngredientBatch(tx, ing.id, start, { expiresAt: exp.expiresAt, reason: "PURCHASE", note: "Opening stock", staffId: staff.id });
      });
    }
    refresh();
    return { ok: true, message: v.id ? "Ingredient updated" : "Ingredient added" };
  });
}

const adjustSchema = z.object({
  ingredientId: z.string().min(1),
  direction: z.enum(["add", "reduce"]),
  quantity: z.number().positive("Enter a quantity").max(1_000_000),
  reason: z.enum(["PURCHASE", "USAGE", "WASTAGE", "ADJUSTMENT"]),
  note: z.string().trim().max(200).optional().default(""),
  /** Reduce from this batch only (otherwise expired stock first, then earliest expiry). */
  batchId: z.string().optional().nullable(),
  ...expiryFields,
});

/** Add stock (a new batch with its own expiry) or reduce it (from batches), with a StockMovement for each change. */
export async function adjustStock(input: z.input<typeof adjustSchema>) {
  return adminAction("inventory", async (staff) => {
    const parsed = adjustSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const v = parsed.data;
    let expiresAt: Date | null = null;
    if (v.direction === "add") {
      const exp = parseExpiry(v);
      if (!exp.ok) return { ok: false, error: exp.error, fieldErrors: { expiresOn: exp.error } };
      expiresAt = exp.expiresAt;
    }
    try {
      const ing = await db.$transaction(async (tx) => {
        if (v.direction === "add") {
          await addIngredientBatch(tx, v.ingredientId, v.quantity, { expiresAt, reason: v.reason, note: v.note || null, staffId: staff.id });
        } else {
          await reduceIngredient(tx, v.ingredientId, v.quantity, { reason: v.reason, note: v.note || null, staffId: staff.id, batchId: v.batchId });
        }
        return tx.ingredient.findUniqueOrThrow({ where: { id: v.ingredientId } });
      });
      refresh();
      return { ok: true, message: `${ing.name}: now ${Number(ing.currentStock)} ${ing.unit.toLowerCase()}` };
    } catch (e) {
      if (e instanceof StockReduceError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

/** Throw away what's left of a batch (usually expired stock). */
export async function discardBatch(batchId: string) {
  return adminAction("inventory", async (staff) => {
    if (typeof batchId !== "string" || !batchId) return { ok: false, error: "Batch not found" };
    const batch = await db.ingredientBatch.findUnique({ where: { id: batchId }, include: { ingredient: { select: { name: true } } } });
    if (!batch || Number(batch.quantityRemaining) <= 0) return { ok: false, error: "Nothing left in that batch." };
    const expired = !!batch.expiresAt && batch.expiresAt <= new Date();
    await db.$transaction((tx) =>
      reduceIngredient(tx, batch.ingredientId, Number(batch.quantityRemaining), {
        reason: "WASTAGE",
        note: expired ? "Expired – discarded" : "Discarded",
        staffId: staff.id,
        batchId,
      }),
    );
    refresh();
    return { ok: true, message: `${batch.ingredient.name}: batch discarded` };
  });
}

const batchExpirySchema = z.object({ batchId: z.string().min(1), ...expiryFields });

/** Correct the expiry date of a batch (e.g. a typo when it was added). */
export async function updateBatchExpiry(input: z.input<typeof batchExpirySchema>) {
  return adminAction("inventory", async () => {
    const parsed = batchExpirySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Pick a valid date" };
    const v = parsed.data;
    let expiresAt: Date | null = null;
    if (!v.noExpiry) {
      // Past dates are allowed here – correcting a date can legitimately mark stock as expired.
      const day = v.expiresOn ? parseISTDate(v.expiresOn) : null;
      if (!day) return { ok: false, error: "Pick a valid expiry date." };
      expiresAt = new Date(addDays(day, 1).getTime() - 1);
    }
    await db.ingredientBatch.update({ where: { id: v.batchId }, data: { expiresAt } });
    refresh();
    return { ok: true, message: "Expiry date updated" };
  });
}

/** Batches that still have stock, earliest expiry first. */
export async function getIngredientBatches(ingredientId: string) {
  await requireRoleForAction("inventory");
  const rows = await db.ingredientBatch.findMany({
    where: { ingredientId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    received: Number(b.quantityReceived),
    remaining: Number(b.quantityRemaining),
    expiresAt: b.expiresAt?.toISOString() ?? null,
    receivedAt: b.receivedAt.toISOString(),
    note: b.note,
    by: b.createdBy?.name ?? null,
  }));
}

export async function getStockHistory(ingredientId: string) {
  await requireRoleForAction("inventory");
  const rows = await db.stockMovement.findMany({
    where: { ingredientId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { staff: { select: { name: true } }, order: { select: { orderNumber: true } }, batch: { select: { expiresAt: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    change: Number(r.change),
    reason: r.reason,
    note: r.note,
    by: r.staff?.name ?? null,
    orderNumber: r.order?.orderNumber ?? null,
    batchExpiresAt: r.batch?.expiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
