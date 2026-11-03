import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export class StockError extends Error {}

/**
 * Wholesale orders take finished stock from batches when confirmed – earliest expiry first,
 * never from expired batches. Idempotent per order (uses Order.stockDeducted as the claim).
 */
export async function allocateBatchesForOrder(tx: Tx, orderId: string, staffId: string | null, orderNumber: string) {
  const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: false }, data: { stockDeducted: true } });
  if (claimed.count === 0) return;

  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true, productName: true, size: true } });
  const need = new Map<string, { qty: number; label: string }>();
  for (const i of items) {
    if (!i.variantId) throw new StockError(`${i.productName} is no longer in the catalogue – it can't be taken from stock.`);
    const prev = need.get(i.variantId);
    need.set(i.variantId, { qty: (prev?.qty ?? 0) + i.quantity, label: `${i.productName} (${i.size.toLowerCase()})` });
  }

  const now = new Date();
  for (const [variantId, { qty, label }] of need) {
    // Lock the candidate batches so two confirmations can't take the same units.
    const batches = await tx.$queryRaw<{ id: string; quantityRemaining: number }[]>`
      SELECT "id", "quantityRemaining" FROM "Batch"
      WHERE "variantId" = ${variantId} AND "quantityRemaining" > 0 AND "expiresAt" > ${now}
      ORDER BY "expiresAt" ASC, "manufacturedAt" ASC
      FOR UPDATE`;
    const available = batches.reduce((s, b) => s + b.quantityRemaining, 0);
    if (available < qty) throw new StockError(`Not enough finished stock for ${label}: need ${qty}, have ${available}. Add a production batch first.`);
    let left = qty;
    for (const b of batches) {
      if (left === 0) break;
      const take = Math.min(left, b.quantityRemaining);
      await tx.batch.update({ where: { id: b.id }, data: { quantityRemaining: { decrement: take } } });
      await tx.batchMovement.create({ data: { batchId: b.id, change: -take, reason: "SALE", orderId, staffId, note: `Order ${orderNumber}` } });
      left -= take;
    }
  }
}

/** Return stock to the same batches when a confirmed wholesale order is cancelled. */
export async function restoreBatchesForOrder(tx: Tx, orderId: string, staffId: string | null, orderNumber: string) {
  const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: true }, data: { stockDeducted: false } });
  if (claimed.count === 0) return;
  const moves = await tx.batchMovement.groupBy({ by: ["batchId"], where: { orderId, reason: { in: ["SALE", "RETURN"] } }, _sum: { change: true } });
  for (const m of moves) {
    const out = -(m._sum.change ?? 0); // net units still out for this order
    if (out <= 0) continue;
    await tx.batch.update({ where: { id: m.batchId }, data: { quantityRemaining: { increment: out } } });
    await tx.batchMovement.create({ data: { batchId: m.batchId, change: out, reason: "RETURN", orderId, staffId, note: `Order ${orderNumber} cancelled` } });
  }
}
