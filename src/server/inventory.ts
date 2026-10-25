import "server-only";
import { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Total ingredient usage for an order: recipe quantityPerUnit × item quantity, summed per ingredient. */
async function usageForOrder(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, product: { select: { recipe: { select: { ingredientId: true, quantityPerUnit: true } } } } },
  });
  const usage = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    for (const r of item.product.recipe) {
      const add = new Prisma.Decimal(r.quantityPerUnit).mul(item.quantity);
      usage.set(r.ingredientId, (usage.get(r.ingredientId) ?? new Prisma.Decimal(0)).add(add));
    }
  }
  return usage;
}

/** Deduct stock when an order is confirmed. Runs inside the status-change transaction. Idempotent per order. */
export async function deductStockForOrder(tx: Tx, orderId: string, staffId: string | null, orderNumber: string) {
  const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: false }, data: { stockDeducted: true } });
  if (claimed.count === 0) return;
  const usage = await usageForOrder(tx, orderId);
  for (const [ingredientId, qty] of usage) {
    await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: { decrement: qty } } });
    await tx.stockMovement.create({
      data: { ingredientId, change: qty.neg(), reason: "USAGE", note: `Order ${orderNumber}`, orderId, staffId },
    });
  }
}

/** Put stock back when a confirmed order is cancelled. */
export async function restoreStockForOrder(tx: Tx, orderId: string, staffId: string | null, orderNumber: string) {
  const claimed = await tx.order.updateMany({ where: { id: orderId, stockDeducted: true }, data: { stockDeducted: false } });
  if (claimed.count === 0) return;
  const usage = await usageForOrder(tx, orderId);
  for (const [ingredientId, qty] of usage) {
    await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: { increment: qty } } });
    await tx.stockMovement.create({
      data: { ingredientId, change: qty, reason: "ADJUSTMENT", note: `Restored – order ${orderNumber} cancelled`, orderId, staffId },
    });
  }
}
