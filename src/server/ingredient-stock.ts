import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { StockReason } from "@/generated/prisma/enums";
import { allocateForReduction, allocateForUsage, fromMilli, toMilli, type AllocBatch } from "@/lib/ingredient-stock";

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof db;

/** A batch that still counts as stock: something left and not past its expiry. */
export function usableBatchWhere(now = new Date()): Prisma.IngredientBatchWhereInput {
  return { quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

async function blockedProductIds(client: Client): Promise<Set<string>> {
  const rows = await client.product.findMany({
    where: { recipe: { some: { ingredient: { batches: { none: usableBatchWhere() } } } } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Products that can't be made right now because an ingredient in their recipe has no usable
 * stock (used up or expired). Shop pages and checkout treat these as unavailable.
 */
export const getStockBlockedProductIds = cache(() => blockedProductIds(db));
export const getStockBlockedProductIdsTx = (client: Client) => blockedProductIds(client);

/** Lock an ingredient's batches for the rest of the transaction and return them. */
async function lockedBatches(tx: Tx, ingredientId: string): Promise<AllocBatch[]> {
  await tx.$queryRaw`SELECT "id" FROM "IngredientBatch" WHERE "ingredientId" = ${ingredientId} AND "quantityRemaining" > 0 FOR UPDATE`;
  const rows = await tx.ingredientBatch.findMany({
    where: { ingredientId, quantityRemaining: { gt: 0 } },
    select: { id: true, quantityRemaining: true, expiresAt: true, receivedAt: true },
  });
  return rows.map((r) => ({ id: r.id, remaining: toMilli(r.quantityRemaining), expiresAt: r.expiresAt, receivedAt: r.receivedAt }));
}

const dec = (milli: number) => new Prisma.Decimal(fromMilli(milli));

async function takeFromBatches(
  tx: Tx,
  ingredientId: string,
  takes: { id: string; qty: number }[],
  m: { reason: StockReason; note: string | null; orderId?: string | null; staffId: string | null },
) {
  let total = 0;
  for (const t of takes) {
    await tx.ingredientBatch.update({ where: { id: t.id }, data: { quantityRemaining: { decrement: dec(t.qty) } } });
    await tx.stockMovement.create({
      data: { ingredientId, batchId: t.id, change: dec(-t.qty), reason: m.reason, note: m.note, orderId: m.orderId ?? null, staffId: m.staffId },
    });
    total += t.qty;
  }
  if (total > 0) await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: { decrement: dec(total) } } });
  return total;
}

/**
 * Use an ingredient for an order or production batch: takes from usable batches, earliest
 * expiry first, never from expired stock. If recorded stock runs short, the rest is noted on
 * the movement (stock never goes below zero).
 */
export async function consumeIngredient(
  tx: Tx,
  ingredientId: string,
  quantity: Prisma.Decimal,
  m: { note: string; orderId?: string | null; staffId: string | null },
) {
  const need = toMilli(quantity);
  if (need <= 0) return;
  const { takes, shortfall } = allocateForUsage(await lockedBatches(tx, ingredientId), need);
  const note = shortfall > 0 ? `${m.note} · ${fromMilli(shortfall)} not in recorded stock` : m.note;
  if (takes.length === 0) {
    // Nothing usable – keep a record that it was needed.
    await tx.stockMovement.create({ data: { ingredientId, change: 0, reason: "USAGE", note, orderId: m.orderId ?? null, staffId: m.staffId } });
    return;
  }
  // Put the shortfall note on the last movement only.
  const head = takes.slice(0, -1);
  const last = takes.slice(-1);
  await takeFromBatches(tx, ingredientId, head, { reason: "USAGE", note: m.note, orderId: m.orderId, staffId: m.staffId });
  await takeFromBatches(tx, ingredientId, last, { reason: "USAGE", note, orderId: m.orderId, staffId: m.staffId });
}

export class StockReduceError extends Error {}

/** Manual reduction (wastage / correction): a chosen batch, or expired stock first then earliest expiry. */
export async function reduceIngredient(
  tx: Tx,
  ingredientId: string,
  quantity: number,
  m: { reason: StockReason; note: string | null; staffId: string; batchId?: string | null },
) {
  const need = toMilli(quantity);
  let batches = await lockedBatches(tx, ingredientId);
  if (m.batchId) batches = batches.filter((b) => b.id === m.batchId);
  const available = batches.reduce((s, b) => s + b.remaining, 0);
  if (need > available)
    throw new StockReduceError(m.batchId ? `That batch only has ${fromMilli(available)} left.` : `Only ${fromMilli(available)} in stock.`);
  const { takes } = allocateForReduction(batches, need);
  await takeFromBatches(tx, ingredientId, takes, { reason: m.reason, note: m.note, staffId: m.staffId });
}

/** Add a new batch (purchase / opening stock / found stock). */
export async function addIngredientBatch(
  tx: Tx,
  ingredientId: string,
  quantity: number,
  m: { expiresAt: Date | null; reason: StockReason; note: string | null; staffId: string | null },
) {
  const qty = new Prisma.Decimal(quantity);
  const batch = await tx.ingredientBatch.create({
    data: { ingredientId, quantityReceived: qty, quantityRemaining: qty, expiresAt: m.expiresAt, note: m.note, createdById: m.staffId },
  });
  await tx.stockMovement.create({ data: { ingredientId, batchId: batch.id, change: qty, reason: m.reason, note: m.note, staffId: m.staffId } });
  await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: { increment: qty } } });
  return batch;
}

/** Put back what an order took, into the same batches (on cancellation). */
export async function returnOrderIngredients(tx: Tx, orderId: string, staffId: string | null, note: string) {
  const moves = await tx.stockMovement.groupBy({
    by: ["ingredientId", "batchId"],
    where: { orderId },
    _sum: { change: true },
  });
  for (const mv of moves) {
    const out = -toMilli(mv._sum.change ?? 0); // net still taken by this order
    if (out <= 0) continue;
    if (!mv.batchId) {
      // Taken before batch tracking existed: return it as a new batch without an expiry date.
      await addIngredientBatch(tx, mv.ingredientId, fromMilli(out), { expiresAt: null, reason: "ADJUSTMENT", note, staffId });
      continue;
    }
    const q = dec(out);
    await tx.ingredientBatch.update({ where: { id: mv.batchId }, data: { quantityRemaining: { increment: q } } });
    await tx.stockMovement.create({ data: { ingredientId: mv.ingredientId, batchId: mv.batchId, change: q, reason: "ADJUSTMENT", note, orderId, staffId } });
    await tx.ingredient.update({ where: { id: mv.ingredientId }, data: { currentStock: { increment: q } } });
  }
}
