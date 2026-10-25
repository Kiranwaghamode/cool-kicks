import { PageHeader } from "@/components/admin/ui";
import { OrdersBoard, type OrderRow, type TabKey } from "./orders-board";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, parseISTDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { OrderStatus } from "@/lib/order-status";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 20;

const TAB_STATUSES: Record<TabKey, OrderStatus[] | null> = {
  ALL: null,
  NEW: ["PLACED"],
  CONFIRMED: ["CONFIRMED"],
  PREPARING: ["PREPARING"],
  READY: ["READY_FOR_PICKUP"],
  OUT: ["OUT_FOR_DELIVERY"],
  DELIVERED: ["DELIVERED"],
  CLOSED: ["CANCELLED", "REJECTED"],
};

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const staff = await requireRole("orders");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const statusParam = str("status");
  const tab: TabKey =
    (Object.keys(TAB_STATUSES) as TabKey[]).find((t) => t === str("tab")) ??
    (statusParam === "PLACED" ? "NEW" : "ALL");
  const q = str("q").trim().slice(0, 30);
  const from = parseISTDate(str("from"));
  const to = parseISTDate(str("to"));
  const page = Math.max(1, Number(str("page")) || 1);

  const base: Prisma.OrderWhereInput = {
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q.toUpperCase() } },
            { customerPhone: { contains: q.replace(/\D/g, "") || q } },
            { customerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: addDays(to, 1) } : {}) } } : {}),
  };
  const statuses = TAB_STATUSES[tab];
  const where: Prisma.OrderWhereInput = { ...base, ...(statuses ? { status: { in: statuses } } : {}) };

  const [grouped, total, orders] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { select: { quantity: true } } },
    }),
  ]);
  const countOf = (s: OrderStatus[]) => grouped.filter((g) => s.includes(g.status as OrderStatus)).reduce((n, g) => n + g._count._all, 0);
  const counts = Object.fromEntries(
    (Object.keys(TAB_STATUSES) as TabKey[]).map((t) => [t, TAB_STATUSES[t] ? countOf(TAB_STATUSES[t]!) : grouped.reduce((n, g) => n + g._count._all, 0)]),
  ) as Record<TabKey, number>;

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    fulfilment: o.fulfilment,
    status: o.status as OrderStatus,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader title="Orders" description="New orders refresh automatically every 15 seconds." />
      <OrdersBoard
        rows={rows}
        counts={counts}
        tab={tab}
        q={q}
        from={str("from")}
        to={str("to")}
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total}
        canRefund={can(staff.role, "ordersRefund")}
        openOrder={str("open")}
      />
    </>
  );
}
