import "server-only";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth-guard";
import { addDays, formatDayLabel, istDateKey, startOfDayIST } from "@/lib/dates";
import { NON_SALE_STATUSES } from "@/lib/order-status";

const saleStatus = { notIn: NON_SALE_STATUSES };

export async function getDashboardData() {
  await requireRole("dashboard");
  const today = startOfDayIST();
  const weekStart = addDays(today, -6);
  const monthAgo = addDays(today, -29);

  const [todayAgg, todayCount, pending, cancelledToday, weekOrders, latest, bestRaw, ingredients] = await Promise.all([
    db.order.aggregate({ where: { createdAt: { gte: today }, status: saleStatus }, _sum: { total: true }, _count: { _all: true } }),
    db.order.count({ where: { createdAt: { gte: today } } }),
    db.order.count({ where: { status: "PLACED" } }),
    db.order.count({ where: { createdAt: { gte: today }, status: { in: NON_SALE_STATUSES } } }),
    db.order.findMany({ where: { createdAt: { gte: weekStart }, status: saleStatus }, select: { createdAt: true, total: true } }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, fulfilment: true, createdAt: true, paymentStatus: true },
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
      d.value += o.total;
      d.orders += 1;
    }
  }
  const salesSeries = [...byDay.entries()].map(([k, v]) => ({ label: formatDayLabel(k), ...v }));

  const salesToday = todayAgg._sum.total ?? 0;
  const saleOrdersToday = todayAgg._count._all;
  const lowStock = ingredients
    .filter((i) => Number(i.currentStock) <= Number(i.lowStockThreshold))
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: Number(i.currentStock), threshold: Number(i.lowStockThreshold) }));

  return {
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
