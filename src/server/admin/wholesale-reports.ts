import "server-only";
import { db } from "@/lib/db";
import { NON_SALE_STATUSES } from "@/lib/order-status";
import { BUSINESS_TYPE_LABELS, type BusinessType } from "@/lib/types";

/**
 * Wholesale (B2B) reports. All figures are REVENUE excluding GST (GST collected is shown
 * separately and is never revenue). Cancelled / rejected orders are excluded.
 * "Estimated gross margin" uses batch cost prices where they are known – it is an estimate,
 * not profit (expenses, wastage and overheads are not included).
 */

/** Unpaid balance per business on open wholesale orders, with overdue invoice amounts. */
export async function getOutstandingByBusiness() {
  const rows = await db.$queryRaw<{ businessId: string; outstanding: bigint; overdue: bigint }[]>`
    SELECT o."businessId",
           SUM(GREATEST(o."total" - o."amountPaid", 0)) AS outstanding,
           SUM(CASE WHEN i."status" = 'ISSUED' AND i."dueDate" < now() THEN GREATEST(o."total" - o."amountPaid", 0) ELSE 0 END) AS overdue
    FROM "Order" o LEFT JOIN "Invoice" i ON i."orderId" = o."id"
    WHERE o."channel" = 'WHOLESALE' AND o."businessId" IS NOT NULL AND o."status" NOT IN ('CANCELLED', 'REJECTED')
    GROUP BY o."businessId"
    HAVING SUM(GREATEST(o."total" - o."amountPaid", 0)) > 0
    ORDER BY overdue DESC, outstanding DESC`;
  if (!rows.length) return [];
  const businesses = await db.business.findMany({
    where: { id: { in: rows.map((r) => r.businessId) } },
    select: { id: true, legalName: true, tradeName: true, credit: { select: { isActive: true, creditLimit: true } } },
  });
  const byId = new Map(businesses.map((b) => [b.id, b]));
  return rows.map((r) => {
    const b = byId.get(r.businessId);
    return {
      businessId: r.businessId,
      name: b ? b.tradeName || b.legalName : "Unknown",
      outstanding: Number(r.outstanding),
      overdue: Number(r.overdue),
      creditActive: !!b?.credit?.isActive,
      creditLimit: b?.credit?.creditLimit ?? 0,
    };
  });
}

export async function getWholesaleReport(from: Date, to: Date) {
  const where = { channel: "WHOLESALE" as const, createdAt: { gte: from, lt: to }, status: { notIn: NON_SALE_STATUSES } };
  const [orders, items, refunds, saleMoves] = await Promise.all([
    db.order.findMany({
      where,
      select: { id: true, subtotal: true, discount: true, deliveryFee: true, taxTotal: true, total: true, business: { select: { id: true, legalName: true, tradeName: true, type: true } } },
    }),
    db.orderItem.findMany({
      where: { order: where },
      select: { productId: true, productName: true, size: true, quantity: true, lineTotal: true, variantId: true },
    }),
    db.payment.aggregate({ where: { kind: "REFUND", order: where }, _sum: { amount: true } }),
    db.batchMovement.findMany({
      where: { reason: { in: ["SALE", "RETURN"] }, order: where },
      select: { change: true, orderId: true, batch: { select: { costPerUnit: true, variantId: true } } },
    }),
  ]);

  const gross = orders.reduce((s, o) => s + o.subtotal + o.deliveryFee, 0);
  const discounts = orders.reduce((s, o) => s + o.discount, 0);
  const gst = orders.reduce((s, o) => s + o.taxTotal, 0);
  const refundTotal = refunds._sum.amount ?? 0;

  // Business-wise and type-wise (retailer / distributor) sales.
  const byBusiness = new Map<string, { businessId: string; name: string; type: BusinessType; orders: number; net: number; gst: number }>();
  for (const o of orders) {
    if (!o.business) continue;
    const b = byBusiness.get(o.business.id) ?? { businessId: o.business.id, name: o.business.tradeName || o.business.legalName, type: o.business.type, orders: 0, net: 0, gst: 0 };
    b.orders += 1;
    b.net += o.subtotal - o.discount + o.deliveryFee;
    b.gst += o.taxTotal;
    byBusiness.set(o.business.id, b);
  }
  const businesses = [...byBusiness.values()].sort((a, b) => b.net - a.net);
  const byType = (["RETAILER", "DISTRIBUTOR"] as const).map((t) => {
    const rows = businesses.filter((b) => b.type === t);
    return { label: `${BUSINESS_TYPE_LABELS[t]}s`, value: rows.reduce((s, b) => s + b.net, 0), orders: rows.reduce((s, b) => s + b.orders, 0), businesses: rows.length };
  });

  // Product demand (units and revenue before order discounts).
  const demand = new Map<string, { name: string; units: number; revenue: number }>();
  for (const i of items) {
    const key = `${i.productId}|${i.size}`;
    const d = demand.get(key) ?? { name: `${i.productName} (${i.size.toLowerCase()})`, units: 0, revenue: 0 };
    d.units += i.quantity;
    d.revenue += i.lineTotal;
    demand.set(key, d);
  }
  const productDemand = [...demand.values()].sort((a, b) => b.units - a.units);

  // Estimated cost of goods from batch movements (units out × batch cost).
  let cogs = 0;
  const costedOrders = new Set<string>();
  let uncostedUnits = 0;
  for (const m of saleMoves) {
    const units = -m.change; // SALE is negative, RETURN positive
    if (m.batch.costPerUnit === null) {
      uncostedUnits += units;
      continue;
    }
    cogs += units * m.batch.costPerUnit;
    if (m.orderId) costedOrders.add(m.orderId);
  }
  const costedRevenue = items.length
    ? orders.filter((o) => costedOrders.has(o.id)).reduce((s, o) => s + o.subtotal - o.discount, 0)
    : 0;

  return {
    orderCount: orders.length,
    gross,
    discounts,
    refunds: refundTotal,
    net: gross - discounts - refundTotal,
    gst,
    businesses,
    byType,
    productDemand,
    margin: {
      revenue: costedRevenue,
      cogs,
      estimated: costedRevenue - cogs,
      pct: costedRevenue > 0 ? Math.round(((costedRevenue - cogs) / costedRevenue) * 1000) / 10 : null,
      uncostedUnits,
      confirmedOrders: costedOrders.size,
    },
  };
}

export type WholesaleReport = Awaited<ReturnType<typeof getWholesaleReport>>;
