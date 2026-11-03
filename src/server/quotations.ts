import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { calculateWholesaleTotals } from "@/lib/wholesale-pricing";

/** Recalculate a quotation's totals from its items (always on the server). */
export async function recalcQuotation(tx: Prisma.TransactionClient, quotationId: string) {
  const [q, settings] = await Promise.all([
    tx.quotation.findUniqueOrThrow({ where: { id: quotationId }, include: { items: { orderBy: { id: "asc" } } } }),
    tx.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { stateCode: true } }),
  ]);
  const t = calculateWholesaleTotals({
    lines: q.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, gstRateBps: i.gstRateBps })),
    discount: q.discount,
    deliveryFee: q.fulfilment === "DELIVERY" ? q.deliveryFee : 0,
    interState: q.placeOfSupply !== settings.stateCode,
  });
  for (const [k, i] of q.items.entries()) {
    await tx.quotationItem.update({ where: { id: i.id }, data: { lineTotal: t.lines[k].lineTotal, taxAmount: t.lines[k].tax } });
  }
  await tx.quotation.update({
    where: { id: quotationId },
    data: { subtotal: t.subtotal, discount: t.discount, deliveryFee: t.deliveryFee, cgst: t.cgst, sgst: t.sgst, igst: t.igst, taxTotal: t.taxTotal, total: t.total },
  });
  return t;
}

/** A sent quote past its validity date can no longer be accepted. */
export function isQuoteExpired(q: { status: string; validUntil: Date | null }) {
  return q.status === "QUOTED" && !!q.validUntil && q.validUntil < new Date();
}
