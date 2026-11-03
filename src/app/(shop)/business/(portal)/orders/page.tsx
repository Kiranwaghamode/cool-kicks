import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireBusiness } from "@/server/business-auth";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import { ACTIVE_STATUSES, statusLabel, type OrderStatus } from "@/lib/order-status";
import { DELIVERY_SLOT_LABELS, PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Orders" };

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "delivered", label: "Delivered" },
  { value: "unpaid", label: "Unpaid" },
  { value: "all", label: "All" },
] as const;

export default async function BusinessOrdersPage({ searchParams }: PageProps<"/business/orders">) {
  const business = await requireBusiness({ approved: true });
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.value === sp.f)?.value ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";

  const where: Prisma.OrderWhereInput = {
    businessId: business.id,
    ...(filter === "open" ? { status: { in: ACTIVE_STATUSES } } : {}),
    ...(filter === "delivered" ? { status: "DELIVERED" } : {}),
    ...(filter === "unpaid" ? { paymentStatus: { in: ["PENDING", "PARTIALLY_PAID"] }, status: { notIn: ["CANCELLED", "REJECTED"] } } : {}),
    ...(q ? { OR: [{ orderNumber: { contains: q.toUpperCase() } }, { poNumber: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      orderNumber: true,
      status: true,
      paymentStatus: true,
      total: true,
      amountPaid: true,
      createdAt: true,
      poNumber: true,
      fulfilment: true,
      delivery: { select: { scheduledDate: true, slot: true } },
      invoice: { select: { number: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Orders</h1>
          <p className="text-ink-soft">Track deliveries, payments and invoices. Search by order or PO number.</p>
        </div>
        <LinkButton href="/business/catalogue">New order</LinkButton>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Filter orders" className="flex gap-1 rounded-full bg-cream p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/business/orders?f=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={filter === f.value ? "page" : undefined}
              className={cn("h-10 rounded-full px-4 text-sm leading-10 font-semibold", filter === f.value ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form role="search" className="ml-auto">
          <input type="hidden" name="f" value={filter} />
          <label htmlFor="o-q" className="sr-only">
            Search orders
          </label>
          <input id="o-q" name="q" defaultValue={q} placeholder="Order # or PO #" className="h-10 w-56 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title={q || filter !== "all" ? "No matching orders" : "No orders yet"} description="Orders you place will appear here." action={<LinkButton href="/business/catalogue">Browse catalogue</LinkButton>} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.orderNumber}>
              <Link href={`/business/orders/${o.orderNumber}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card bg-surface p-4 shadow-warm-soft transition hover:shadow-warm md:p-5">
                <div className="min-w-40 flex-1">
                  <p className="font-extrabold">{o.orderNumber}</p>
                  <p className="text-xs text-ink-muted">
                    {formatDate(o.createdAt)} · {o._count.items} item{o._count.items === 1 ? "" : "s"}
                    {o.poNumber ? ` · PO ${o.poNumber}` : ""}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-ink-muted">{o.fulfilment === "DELIVERY" ? "Delivery" : "Pickup"}</p>
                  <p className="font-semibold">{o.delivery ? `${formatDate(o.delivery.scheduledDate)} · ${DELIVERY_SLOT_LABELS[o.delivery.slot].split(" ")[0]}` : "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={o.status === "DELIVERED" ? "success" : o.status === "CANCELLED" || o.status === "REJECTED" ? "neutral" : "ice"}>{statusLabel(o.status as OrderStatus, "WHOLESALE")}</Badge>
                  <Badge tone={o.paymentStatus === "PAID" ? "success" : o.paymentStatus === "PARTIALLY_PAID" ? "ice" : "warning"}>{PAYMENT_STATUS_LABELS[o.paymentStatus as PaymentStatus]}</Badge>
                  {o.invoice && <Badge tone="neutral">Invoiced</Badge>}
                </div>
                <div className="ml-auto text-right">
                  <p className="font-extrabold tabular-nums">{formatPaise(o.total)}</p>
                  {o.amountPaid > 0 && o.amountPaid < o.total && <p className="text-xs text-warning">{formatPaise(o.total - o.amountPaid)} due</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
