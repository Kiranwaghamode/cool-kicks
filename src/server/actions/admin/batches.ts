"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { adminAction } from "@/server/auth-guard";
import { audit } from "@/server/audit";
import { addDays, istDateKey, parseISTDate, startOfDayIST } from "@/lib/dates";

function refresh() {
  revalidatePath("/admin/finished-stock");
  revalidatePath("/admin", "layout");
  revalidatePath("/business", "layout");
}

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const batchSchema = z.object({
  variantId: z.string().min(1, "Choose a product"),
  batchNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(30)
    .regex(/^[A-Z0-9/_-]*$/, "Letters, numbers, / - _ only")
    .optional()
    .default(""),
  manufacturedAt: dateKey,
  expiresAt: dateKey,
  quantity: z.number().int().min(1, "Enter the quantity produced").max(1_000_000),
  costPerUnit: z.number().int().min(0).max(100_000_000).nullable(),
  deductIngredients: z.boolean(),
  note: z.string().trim().max(200).optional().default(""),
});

export type BatchInput = z.input<typeof batchSchema>;

/** Record a production batch of finished product (optionally using up recipe ingredients). */
export async function createBatch(input: BatchInput) {
  return adminAction<{ batchNumber: string }>("batches", async (staff) => {
    const parsed = batchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const v = parsed.data;
    const mfg = parseISTDate(v.manufacturedAt);
    const exp = parseISTDate(v.expiresAt);
    if (!mfg || !exp) return { ok: false, error: "Pick valid dates" };
    if (mfg > startOfDayIST()) return { ok: false, error: "Manufacturing date can't be in the future." };
    if (exp <= mfg) return { ok: false, error: "Expiry must be after the manufacturing date." };
    // Valid through the end of the expiry day.
    const expiresAt = new Date(addDays(exp, 1).getTime() - 1);

    const variant = await db.productVariant.findUnique({
      where: { id: v.variantId },
      select: { size: true, product: { select: { id: true, name: true, recipe: { select: { ingredientId: true, quantityPerUnit: true, ingredient: { select: { costPerUnit: true } } } } } } },
    });
    if (!variant) return { ok: false, error: "Product not found" };

    // Cost per unit from recipe ingredient costs when not entered and every ingredient has a cost.
    let cost = v.costPerUnit;
    const recipe = variant.product.recipe;
    if (cost === null && recipe.length && recipe.every((r) => r.ingredient.costPerUnit !== null)) {
      cost = Math.round(recipe.reduce((s, r) => s + Number(r.quantityPerUnit) * (r.ingredient.costPerUnit ?? 0), 0));
    }

    try {
      const batch = await db.$transaction(async (tx) => {
        let number = v.batchNumber;
        if (!number) {
          const prefix = `B-${istDateKey(mfg).replace(/-/g, "")}`;
          const count = await tx.batch.count({ where: { batchNumber: { startsWith: prefix } } });
          number = `${prefix}-${String(count + 1).padStart(2, "0")}`;
        }
        const b = await tx.batch.create({
          data: {
            batchNumber: number,
            variantId: v.variantId,
            manufacturedAt: mfg,
            expiresAt,
            quantityProduced: v.quantity,
            quantityRemaining: v.quantity,
            costPerUnit: cost,
            note: v.note || null,
            createdById: staff.id,
          },
        });
        await tx.batchMovement.create({ data: { batchId: b.id, change: v.quantity, reason: "PRODUCTION", staffId: staff.id, note: v.note || "Production" } });
        if (v.deductIngredients) {
          for (const r of recipe) {
            const qty = new Prisma.Decimal(r.quantityPerUnit).mul(v.quantity);
            await tx.ingredient.update({ where: { id: r.ingredientId }, data: { currentStock: { decrement: qty } } });
            await tx.stockMovement.create({ data: { ingredientId: r.ingredientId, change: qty.neg(), reason: "USAGE", note: `Batch ${number}`, staffId: staff.id } });
          }
        }
        await audit(
          { staffId: staff.id },
          { action: "batch.create", entityType: "Batch", entityId: b.id, summary: `Batch ${number}: ${v.quantity} × ${variant.product.name} (${variant.size.toLowerCase()}), expires ${v.expiresAt}` },
          tx,
        );
        return b;
      });
      refresh();
      return { ok: true, message: `Batch ${batch.batchNumber} added`, data: { batchNumber: batch.batchNumber } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "That batch number already exists." };
      throw e;
    }
  });
}

const adjustSchema = z.object({
  batchId: z.string().min(1),
  change: z.number().int().refine((n) => n !== 0, "Enter a quantity").refine((n) => Math.abs(n) <= 1_000_000, "Too large"),
  reason: z.enum(["WASTAGE", "ADJUSTMENT"]),
  note: z.string().trim().min(3, "Add a short note").max(200),
});

/** Write off (wastage / expired) or correct the remaining quantity of a batch. */
export async function adjustBatch(input: z.input<typeof adjustSchema>) {
  return adminAction("batches", async (staff) => {
    const parsed = adjustSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const { batchId, change, reason, note } = parsed.data;
    if (reason === "WASTAGE" && change > 0) return { ok: false, error: "Wastage removes stock – enter how many units to write off." };
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`UPDATE "Batch" SET "quantityRemaining" = "quantityRemaining" + ${change} WHERE "id" = ${batchId} AND "quantityRemaining" + ${change} >= 0`;
      if (updated === 0) return { ok: false as const, error: "That would make the remaining quantity negative." };
      const b = await tx.batch.findUniqueOrThrow({ where: { id: batchId }, select: { batchNumber: true, quantityRemaining: true } });
      await tx.batchMovement.create({ data: { batchId, change, reason, staffId: staff.id, note } });
      await audit({ staffId: staff.id }, { action: `batch.${reason.toLowerCase()}`, entityType: "Batch", entityId: batchId, summary: `Batch ${b.batchNumber}: ${change > 0 ? "+" : ""}${change} (${note})` }, tx);
      return { ok: true as const, message: `Batch ${b.batchNumber}: ${b.quantityRemaining} left` };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** Write off everything left in expired batches. */
export async function writeOffExpired() {
  return adminAction("batches", async (staff) => {
    const expired = await db.batch.findMany({ where: { expiresAt: { lt: new Date() }, quantityRemaining: { gt: 0 } }, select: { id: true, batchNumber: true, quantityRemaining: true } });
    if (!expired.length) return { ok: true, message: "No expired stock to write off" };
    await db.$transaction(async (tx) => {
      for (const b of expired) {
        const updated = await tx.batch.updateMany({ where: { id: b.id, quantityRemaining: b.quantityRemaining }, data: { quantityRemaining: 0 } });
        if (updated.count === 0) continue;
        await tx.batchMovement.create({ data: { batchId: b.id, change: -b.quantityRemaining, reason: "WASTAGE", staffId: staff.id, note: "Expired – written off" } });
      }
      await audit({ staffId: staff.id }, { action: "batch.expired", entityType: "Batch", summary: `Wrote off ${expired.reduce((s, b) => s + b.quantityRemaining, 0)} expired units in ${expired.length} batch(es)` }, tx);
    });
    refresh();
    return { ok: true, message: `Wrote off ${expired.length} expired batch(es)` };
  });
}
