"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { adminAction, requireRoleForAction } from "@/server/auth-guard";

const UNITS = ["KG", "LITRE", "PIECE", "GRAM", "ML"] as const;

const ingredientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  unit: z.enum(UNITS),
  lowStockThreshold: z.number().min(0).max(1_000_000),
  /** Only used when creating. */
  currentStock: z.number().min(0).max(1_000_000).optional(),
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
      await db.ingredient.create({
        data: {
          name: v.name,
          unit: v.unit,
          lowStockThreshold: new Prisma.Decimal(v.lowStockThreshold),
          currentStock: new Prisma.Decimal(start),
          ...(start > 0 ? { movements: { create: { change: new Prisma.Decimal(start), reason: "PURCHASE", note: "Opening stock", staffId: staff.id } } } : {}),
        },
      });
    }
    revalidatePath("/admin", "layout");
    return { ok: true, message: v.id ? "Ingredient updated" : "Ingredient added" };
  });
}

const adjustSchema = z.object({
  ingredientId: z.string().min(1),
  direction: z.enum(["add", "reduce"]),
  quantity: z.number().positive("Enter a quantity").max(1_000_000),
  reason: z.enum(["PURCHASE", "USAGE", "WASTAGE", "ADJUSTMENT"]),
  note: z.string().trim().max(200).optional().default(""),
});

/** Update stock: writes a StockMovement and changes the stock level in one transaction. */
export async function adjustStock(input: z.input<typeof adjustSchema>) {
  return adminAction("inventory", async (staff) => {
    const parsed = adjustSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const v = parsed.data;
    const change = new Prisma.Decimal(v.quantity).mul(v.direction === "add" ? 1 : -1);
    const ing = await db.$transaction(async (tx) => {
      const updated = await tx.ingredient.update({ where: { id: v.ingredientId }, data: { currentStock: { increment: change } } });
      await tx.stockMovement.create({ data: { ingredientId: v.ingredientId, change, reason: v.reason, note: v.note || null, staffId: staff.id } });
      return updated;
    });
    revalidatePath("/admin", "layout");
    return { ok: true, message: `${ing.name}: now ${Number(ing.currentStock)} ${ing.unit.toLowerCase()}` };
  });
}

export async function getStockHistory(ingredientId: string) {
  await requireRoleForAction("inventory");
  const rows = await db.stockMovement.findMany({
    where: { ingredientId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { staff: { select: { name: true } }, order: { select: { orderNumber: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    change: Number(r.change),
    reason: r.reason,
    note: r.note,
    by: r.staff?.name ?? null,
    orderNumber: r.order?.orderNumber ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** One-click: mark every product that uses this ingredient as unavailable. */
export async function markProductsUsingUnavailable(ingredientId: string) {
  return adminAction("inventory", async () => {
    const res = await db.product.updateMany({
      where: { isActive: true, isAvailable: true, recipe: { some: { ingredientId } } },
      data: { isAvailable: false },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: `${res.count} product${res.count === 1 ? "" : "s"} marked unavailable` };
  });
}
