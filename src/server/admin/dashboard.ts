import "server-only";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth-guard";
import { addDays, formatDayLabel, istDateKey, startOfDayIST } from "@/lib/dates";
import { NON_SALE_STATUSES } from "@/lib/order-status";
import { can } from "@/lib/permissions";
import { getOutstandingByBusiness } from "@/server/admin/wholesale-reports";

const saleStatus = { notIn: NON_SALE_STATUSES };

export async function getDashboardData() {
  const staff = await requireRole("dashboard");
  const today = startOfDayIST();
  const weekStart = addDays(today, -6);
  const monthAgo = addDays(today, -29);

  const [todayAgg, todayCount, pending, cancelledToday, weekOrders, latest, bestRaw, ingredients] = await Promise.all([
    db.order.aggregate({ where: { createdAt: { gte: today }, status: saleStatus }, _sum: { total: true, taxTotal: true }, _count: { _all: true } }),
    db.order.count({ where: { createdAt: { gte: today } } }),
    db.order.count({ where: { status: "PLACED" } }),
    db.order.count({ where: { createdAt: { gte: today }, status: { in: NON_SALE_STATUSES } } }),
    db.order.findMany({ where: { createdAt: { gte: weekStart }, status: saleStatus }, select: { createdAt: true, total: true, taxTotal: true } }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, fulfilment: true, createdAt: true, paymentStatus: true, channel: true },
    }),
    db.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { createdAt: { gte: monthAgo }, status: saleStatus } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);

  const byDay = new Map<string, { value: number; orders: number }>();
  for (let i = 0; i < 7; i++) byDay.set(istDateKey(addDays(weekStart, i)), { value: 0, orders: 0 });
  for (const o of weekOrders) {
    const k = istDateKey(o.createdAt);
    const d = byDay.get(k);
    if (d) {
      d.value += o.total - o.taxTotal; // GST collected is not revenue
      d.orders += 1;
    }
  }
  const salesSeries = [...byDay.entries()].map(([k, v]) => ({ label: formatDayLabel(k), ...v }));

  const salesToday = (todayAgg._sum.total ?? 0) - (todayAgg._sum.taxTotal ?? 0);
  const saleOrdersToday = todayAgg._count._all;
  const lowStock = ingredients
    .filter((i) => Number(i.currentStock) <= Number(i.lowStockThreshold))
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: Number(i.currentStock), threshold: Number(i.lowStockThreshold) }));

  const wholesale = can(staff.role, "businesses") ? await getWholesaleSummary(monthAgo) : null;

  return {
    wholesale,
    salesToday,
    ordersToday: todayCount,
    pending,
    cancelledToday,
    avgOrderValue: saleOrdersToday ? Math.round(salesToday / saleOrdersToday) : 0,
    weekTotal: salesSeries.reduce((s, d) => s + d.value, 0),
    salesSeries,
    latest,
    bestSellers: bestRaw.map((b) => ({ name: b.productName, quantity: b._sum.quantity ?? 0, revenue: b._sum.lineTotal ?? 0 })),
    lowStock,
  };
}

/** B2B tiles: business customers, wholesale sales (30 days, excl. GST), quotes, credit and overdue. */
async function getWholesaleSummary(since: Date) {
  const [approved, pendingApproval, sales, openQuotes, quoteRequests, outstanding, expiring] = await Promise.all([
    db.business.count({ where: { status: "APPROVED" } }),
    db.business.count({ where: { status: "PENDING" } }),
    db.order.aggregate({
      where: { channel: "WHOLESALE", createdAt: { gte: since }, status: saleStatus },
      _sum: { subtotal: true, discount: true, deliveryFee: true },
      _count: { _all: true },
    }),
    db.quotation.count({ where: { status: "QUOTED" } }),
    db.quotation.count({ where: { status: "REQUESTED" } }),
    getOutstandingByBusiness(),
    db.batch.count({ where: { quantityRemaining: { gt: 0 }, expiresAt: { gt: new Date(), lt: addDays(new Date(), 3) } } }),
  ]);
  const credit = await db.creditAccount.aggregate({ where: { isActive: true }, _sum: { creditLimit: true }, _count: { _all: true } });
  return {
    approved,
    pendingApproval,
    sales30: (sales._sum.subtotal ?? 0) - (sales._sum.discount ?? 0) + (sales._sum.deliveryFee ?? 0),
    orders30: sales._count._all,
    openQuotes,
    quoteRequests,
    outstanding: outstanding.reduce((s, o) => s + o.outstanding, 0),
    overdue: outstanding.reduce((s, o) => s + o.overdue, 0),
    overdueBusinesses: outstanding.filter((o) => o.overdue > 0).slice(0, 5),
    creditAccounts: credit._count._all,
    creditLimits: credit._sum.creditLimit ?? 0,
    expiringBatches: expiring,
  };
}
