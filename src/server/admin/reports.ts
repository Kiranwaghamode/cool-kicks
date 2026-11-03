import "server-only";
import { db } from "@/lib/db";
import { addDays, formatDayLabel, istDateKey, parseISTDate, startOfDayIST, startOfMonthIST, startOfWeekIST } from "@/lib/dates";
import { NON_SALE_STATUSES } from "@/lib/order-status";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";

export type RangeKey = "today" | "week" | "month" | "custom";

/** Resolve a report range in the shop timezone. `to` is exclusive. */
export function resolveRange(range: string | undefined, fromStr?: string, toStr?: string) {
  const today = startOfDayIST();
  const key: RangeKey = range === "week" || range === "month" || range === "custom" ? range : "today";
  if (key === "week") return { key, from: startOfWeekIST(), to: addDays(today, 1) };
  if (key === "month") return { key, from: startOfMonthIST(), to: addDays(today, 1) };
  if (key === "custom") {
    const f = fromStr ? parseISTDate(fromStr) : null;
    const t = toStr ? parseISTDate(toStr) : null;
    if (f && t && f <= t && t.getTime() - f.getTime() <= 366 * 86_400_000) return { key, from: f, to: addDays(t, 1) };
  }
  return { key: "today" as RangeKey, from: today, to: addDays(today, 1) };
}

/**
 * Sales report. Definitions (revenue – NOT profit):
 *  Gross Sales = item subtotals + delivery fees of non-cancelled orders
 *  Discounts   = coupon discounts on those orders
 *  Refunds     = totals of orders marked refunded
 *  Net Sales   = Gross − Discounts − Refunds
 */
export async function getSalesReport(from: Date, to: Date) {
  const range = { createdAt: { gte: from, lt: to } };
  const [sales, cancelledCount, refunded, items, expenses] = await Promise.all([
    db.order.findMany({
      where: { ...range, status: { notIn: NON_SALE_STATUSES } },
      select: { id: true, orderNumber: true, createdAt: true, subtotal: true, discount: true, deliveryFee: true, total: true, taxTotal: true, channel: true, paymentMethod: true, paymentStatus: true, fulfilment: true, status: true, customerName: true, couponCode: true },
      orderBy: { createdAt: "asc" },
    }),
    db.order.count({ where: { ...range, status: { in: NON_SALE_STATUSES } } }),
    db.order.aggregate({ where: { ...range, channel: "RETAIL", paymentStatus: "REFUNDED" }, _sum: { total: true }, _count: { _all: true } }),
    db.orderItem.findMany({
      where: { order: { ...range, status: { notIn: NON_SALE_STATUSES } } },
      select: { productId: true, productName: true, quantity: true, lineTotal: true, product: { select: { category: { select: { name: true } } } } },
    }),
    db.expense.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "desc" } }),
  ]);

  const gross = sales.reduce((s, o) => s + o.subtotal + o.deliveryFee, 0);
  const discounts = sales.reduce((s, o) => s + o.discount, 0);
  // Retail refunds are whole orders; wholesale refunds are recorded payments (excl. their GST share).
  const wholesaleRefunds = await db.payment.findMany({
    where: { kind: "REFUND", order: { ...range, channel: "WHOLESALE" } },
    select: { amount: true, order: { select: { total: true, taxTotal: true } } },
  });
  const refunds =
    (refunded._sum.total ?? 0) +
    wholesaleRefunds.reduce((s, p) => s + (p.order.total ? Math.round((p.amount * (p.order.total - p.order.taxTotal)) / p.order.total) : 0), 0);
  const gstCollected = sales.reduce((s, o) => s + o.taxTotal, 0);
  const channelSplit = {
    retail: sales.filter((o) => o.channel === "RETAIL").reduce((s, o) => s + o.subtotal - o.discount + o.deliveryFee, 0),
    wholesale: sales.filter((o) => o.channel === "WHOLESALE").reduce((s, o) => s + o.subtotal - o.discount + o.deliveryFee, 0),
  };
  const net = gross - discounts - refunds;
  const orderCount = sales.length;
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // Daily series (sales after discount).
  const days = new Map<string, { value: number; orders: number }>();
  for (let d = new Date(from); d < to; d = addDays(d, 1)) days.set(istDateKey(d), { value: 0, orders: 0 });
  for (const o of sales) {
    const k = istDateKey(o.createdAt);
    const day = days.get(k);
    if (day) {
      day.value += o.total - o.taxTotal;
      day.orders += 1;
    }
  }

  const sumBy = <T extends string>(entries: [T, number][]) => {
    const m = new Map<T, number>();
    for (const [k, v] of entries) m.set(k, (m.get(k) ?? 0) + v);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  const byCategory = sumBy(items.map((i) => [i.product.category.name, i.lineTotal] as [string, number]));
  const byPayment = sumBy(sales.map((o) => [PAYMENT_METHOD_LABELS[o.paymentMethod], o.total - o.taxTotal] as [string, number]));
  const byFulfilment = sumBy(sales.map((o) => [o.fulfilment === "PICKUP" ? "Pickup" : "Delivery", o.total - o.taxTotal] as [string, number]));
  const fulfilmentCounts = { pickup: sales.filter((o) => o.fulfilment === "PICKUP").length, delivery: sales.filter((o) => o.fulfilment === "DELIVERY").length };

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const i of items) {
    const p = productMap.get(i.productId) ?? { name: i.productName, quantity: 0, revenue: 0 };
    p.quantity += i.quantity;
    p.revenue += i.lineTotal;
    productMap.set(i.productId, p);
  }
  const bestSellers = [...productMap.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 15);

  return {
    gross,
    discounts,
    refunds,
    refundCount: refunded._count._all + wholesaleRefunds.length,
    gstCollected,
    channelSplit,
    net,
    orderCount,
    cancelledCount,
    avgOrderValue: orderCount ? Math.round((gross - discounts) / orderCount) : 0,
    expenseTotal,
    estimatedBalance: net - expenseTotal,
    daily: [...days.entries()].map(([k, v]) => ({ key: k, label: formatDayLabel(k), ...v })),
    byCategory,
    byPayment,
    byFulfilment,
    fulfilmentCounts,
    bestSellers,
    expenses: expenses.map((e) => ({ id: e.id, title: e.title, amount: e.amount, category: e.category, date: e.date.toISOString() })),
    orders: sales,
  };
}

export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;
