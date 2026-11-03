import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { WholesaleBill } from "@/components/shop/business/wholesale-bill";
import { requireBusiness } from "@/server/business-auth";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/order-format";
import { formatRate, invoiceSlug } from "@/lib/gst";
import { statusLabel, timelineSteps, WHOLESALE_STATUS_DESCRIPTIONS, type OrderStatus } from "@/lib/order-status";
import { DELIVERY_SLOT_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_MODE_LABELS, PAYMENT_STATUS_LABELS, SIZE_LABELS, type PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OrderActions } from "./order-actions";

export const metadata = { title: "Order" };

export default async function BusinessOrderPage({ params, searchParams }: PageProps<"/business/orders/[orderNumber]">) {
  const business = await requireBusiness();
  const { orderNumber } = await params;
  const sp = await searchParams;
  const o = await db.order.findFirst({
    where: { orderNumber: orderNumber.toUpperCase(), businessId: business.id },
    include: {
      items: { orderBy: { id: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
      delivery: true,
      payments: { orderBy: { receivedAt: "asc" } },
      invoice: { select: { number: true, status: true, dueDate: true } },
      quotation: { select: { number: true } },
    },
  });
  if (!o) notFound();

  const status = o.status as OrderStatus;
  const closed = status === "CANCELLED" || status === "REJECTED";
  const steps = timelineSteps(o.fulfilment, "WHOLESALE");
  const reached = new Map(o.history.map((h) => [h.toStatus as OrderStatus, h.createdAt]));
  const currentIndex = steps.indexOf(status);
  const balance = Math.max(0, o.total - o.amountPaid);

  return (
    <div className="space-y-6">
      <Link href="/business/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Orders
      </Link>

      {sp.placed && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 font-semibold text-brand-deep">
          <CheckCircle2 className="size-5" aria-hidden /> Order placed! We&apos;ll confirm it shortly.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Order {o.orderNumber}</h1>
          <p className="text-ink-soft">
            Placed {formatDateTime(o.createdAt)}
            {o.poNumber ? ` · PO ${o.poNumber}${o.poDate ? ` (${formatDate(o.poDate)})` : ""}` : ""}
            {o.quotation ? ` · from quotation ${o.quotation.number}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={closed ? "neutral" : status === "DELIVERED" ? "success" : "ice"}>{statusLabel(status, "WHOLESALE")}</Badge>
          <Badge tone={o.paymentStatus === "PAID" ? "success" : o.paymentStatus === "PARTIALLY_PAID" ? "ice" : "warning"}>{PAYMENT_STATUS_LABELS[o.paymentStatus as PaymentStatus]}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-card bg-surface p-5 shadow-warm-soft">
            <h2 className="font-bold">Status</h2>
            <p className="mt-1 text-ink-soft">{closed && o.cancelReason ? `${WHOLESALE_STATUS_DESCRIPTIONS[status]} Reason: ${o.cancelReason}` : WHOLESALE_STATUS_DESCRIPTIONS[status]}</p>
            {!closed && (
              <ol className="mt-5 grid gap-3 sm:grid-cols-6">
                {steps.map((s, i) => {
                  const done = i <= currentIndex;
                  return (
                    <li key={s} className="flex items-center gap-2 sm:flex-col sm:items-start">
                      <span className={cn("h-1.5 w-8 rounded-full sm:w-full", done ? "bg-brand" : "bg-cream")} aria-hidden />
                      <span>
                        <span className={cn("block text-sm font-semibold", done ? "text-ink" : "text-ink-muted")}>{statusLabel(s, "WHOLESALE")}</span>
                        {reached.get(s) && <span className="block text-xs text-ink-muted">{formatDateTime(reached.get(s)!)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-card bg-surface p-5 shadow-warm-soft">
            <h2 className="mb-3 font-bold">Items</h2>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
                    <th className="py-2 font-bold">Product</th>
                    <th className="py-2 font-bold">HSN</th>
                    <th className="py-2 text-right font-bold">Qty</th>
                    <th className="py-2 text-right font-bold">Rate</th>
                    <th className="py-2 text-right font-bold">GST</th>
                    <th className="py-2 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 font-semibold">
                        {i.productName} <span className="font-normal text-ink-muted">({SIZE_LABELS[i.size]})</span>
                      </td>
                      <td className="py-2.5 text-ink-muted">{i.hsnCode ?? "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">{i.quantity}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatPaise(i.unitPrice)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatRate(i.gstRateBps)}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{formatPaise(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {o.payments.length > 0 && (
            <section className="rounded-card bg-surface p-5 shadow-warm-soft">
              <h2 className="mb-3 font-bold">Payments</h2>
              <ul className="divide-y divide-line text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-semibold">{p.kind === "REFUND" ? "Refund" : PAYMENT_MODE_LABELS[p.mode]}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatDate(p.receivedAt)}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                      </span>
                    </span>
                    <span className={cn("font-bold tabular-nums", p.kind === "REFUND" && "text-danger")}>
                      {p.kind === "REFUND" ? "−" : ""}
                      {formatPaise(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-card bg-surface p-5 shadow-warm-soft">
            <WholesaleBill totals={o} fulfilment={o.fulfilment} placeOfSupply={o.placeOfSupply} amountPaid={o.amountPaid} />
            <p className="mt-3 text-sm text-ink-soft">
              Payment: <span className="font-semibold text-ink">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</span>
            </p>
            {o.invoice && (
              <LinkButton href={`/business/invoices/${invoiceSlug(o.invoice.number)}`} variant="outline" size="sm" className="mt-3 w-full">
                <FileText className="size-4" aria-hidden /> Invoice {o.invoice.number}
                {o.invoice.status === "ISSUED" && balance > 0 ? ` · due ${formatDate(o.invoice.dueDate)}` : ""}
              </LinkButton>
            )}
          </section>

          <section className="rounded-card bg-surface p-5 text-sm shadow-warm-soft">
            <h2 className="mb-2 flex items-center gap-2 font-bold">
              {o.fulfilment === "DELIVERY" ? <Truck className="size-5" aria-hidden /> : <MapPin className="size-5" aria-hidden />}
              {o.fulfilment === "DELIVERY" ? "Delivery" : "Pickup at shop"}
            </h2>
            {o.delivery && (
              <p className="flex items-center gap-2 font-semibold">
                <CalendarDays className="size-4 text-ink-muted" aria-hidden /> {formatDate(o.delivery.scheduledDate)} · {DELIVERY_SLOT_LABELS[o.delivery.slot]}
              </p>
            )}
            {o.fulfilment === "DELIVERY" && <p className="mt-2 text-ink-soft">{[o.addressLine1, o.addressLine2, o.landmark, o.area, o.city, o.state, o.pincode].filter(Boolean).join(", ")}</p>}
            {o.delivery?.driverName && (
              <p className="mt-2 text-ink-soft">
                Driver: {o.delivery.driverName}
                {o.delivery.vehicle ? ` · ${o.delivery.vehicle}` : ""}
              </p>
            )}
            {o.delivery?.deliveredAt && <p className="mt-2 text-ink-soft">Delivered {formatDateTime(o.delivery.deliveredAt)}</p>}
            {o.delivery?.confirmedByBusinessAt && (
              <p className="mt-2 font-semibold text-brand-deep">
                Receipt confirmed by {o.delivery.receivedBy} on {formatDate(o.delivery.confirmedByBusinessAt)}
              </p>
            )}
          </section>

          <OrderActions
            orderNumber={o.orderNumber}
            canReorder={business.status === "APPROVED"}
            canConfirm={!!o.delivery && !o.delivery.confirmedByBusinessAt && ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED"].includes(status)}
          />
        </aside>
      </div>
    </div>
  );
}
