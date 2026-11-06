"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Ban,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  FileText,
  MapPin,
  Phone,
  Printer,
  RotateCcw,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { WholesaleBill } from "@/components/shop/business/wholesale-bill";
import { WholesaleBadge } from "@/components/admin/ui";
import { PaymentForm } from "./payment-form";
import { formatRate, invoiceSlug } from "@/lib/gst";
import { DELIVERY_SLOT_LABELS, PAYMENT_MODE_LABELS } from "@/lib/types";
import { Drawer, Modal } from "@/components/ui/modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { WhatsAppIcon } from "@/components/shop/icons";
import { BillSummary } from "@/components/shop/bill-summary";
import { PaymentBadge, StatusBadge } from "@/components/admin/ui";
import {
  generateInvoice,
  getAdminOrder,
  markOrderPaid,
  refundOrder,
  updateOrderStatus,
  type AdminOrder,
} from "@/server/actions/admin/orders";
import {
  allowedTransitions,
  statusLabel,
  type OrderStatus,
} from "@/lib/order-status";
import { formatDate, formatDateTime, itemOptions } from "@/lib/order-format";
import { formatPaise } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type Level, type Size } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";
import { useShopName } from "@/components/brand/shop-name";

const WHOLESALE_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm & reserve stock",
  PREPARING: "Start processing",
  PACKED: "Mark packed",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Dispatch",
  DELIVERED: "Mark delivered",
};

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Accept order",
  PREPARING: "Start preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered",
};

function customerMessage(o: AdminOrder, shopName: string) {
  const name = o.customerName.split(" ")[0];
  const map: Record<OrderStatus, string> = {
    PLACED: `Hi ${name}! We've received your ${shopName} order ${o.orderNumber}. We'll confirm it shortly.`,
    CONFIRMED: `Hi ${name}! Your ${shopName} order ${o.orderNumber} is confirmed 🍹`,
    PREPARING: `Hi ${name}! We're preparing your order ${o.orderNumber} right now.`,
    PACKED: `Hi ${name}! Your order ${o.orderNumber} is packed and will be dispatched soon.`,
    READY_FOR_PICKUP: `Hi ${name}! Your order ${o.orderNumber} is ready for pickup at the counter. Total ${formatPaise(o.total)}.`,
    OUT_FOR_DELIVERY: `Hi ${name}! Your order ${o.orderNumber} is out for delivery. Please keep ${formatPaise(o.total)} ready (cash/UPI).`,
    DELIVERED: `Hi ${name}! Hope you enjoyed your ${shopName} order ${o.orderNumber}. Thank you! 💚`,
    CANCELLED: `Hi ${name}, your order ${o.orderNumber} has been cancelled${o.cancelReason ? `: ${o.cancelReason}` : ""}. Sorry for the trouble.`,
    REJECTED: `Hi ${name}, sorry – we couldn't accept order ${o.orderNumber}${o.cancelReason ? `: ${o.cancelReason}` : ""}.`,
  };
  return map[o.status];
}

export function OrderDrawer({
  orderNumber,
  canRefund,
  onClose,
}: {
  orderNumber: string | null;
  canRefund: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [reasonFor, setReasonFor] = useState<"REJECTED" | "CANCELLED" | "REFUND" | null>(null);
  const shopName = useShopName();
  const [reason, setReason] = useState("");

  const load = useCallback(async (num: string) => {
    try {
      const o = await getAdminOrder(num);
      if (!o) setError("Order not found");
      else {
        setOrder(o);
        setError(null);
      }
    } catch {
      setError("Couldn't load this order");
    }
  }, []);

  useEffect(() => {
    if (!orderNumber) return;
    let cancelled = false;
    getAdminOrder(orderNumber)
      .then((o) => {
        if (cancelled) return;
        if (!o) setError("Order not found");
        else {
          setOrder(o);
          setError(null);
        }
      })
      .catch(() => !cancelled && setError("Couldn't load this order"));
    return () => {
      cancelled = true;
      setOrder(null);
      setError(null);
    };
  }, [orderNumber]);

  function act(p: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await p();
      if (res.ok) {
        toast.success(res.message ?? "Updated");
        if (orderNumber) await load(orderNumber);
        router.refresh();
      } else toast.error("Not updated", res.error);
    });
  }

  const wholesale = order?.channel === "WHOLESALE";
  const next = order
    ? allowedTransitions(order.status, order.fulfilment, order.channel).filter(
        (s) => s !== "CANCELLED" && s !== "REJECTED",
      )
    : [];
  const canReject = order?.status === "PLACED";
  const canCancel = order
    ? allowedTransitions(order.status, order.fulfilment, order.channel).includes("CANCELLED")
    : false;
  const actionLabel = (s: OrderStatus) =>
    (wholesale ? WHOLESALE_ACTION_LABELS[s] : ACTION_LABELS[s]) ?? statusLabel(s, order?.channel);

  return (
    <Drawer
      open={!!orderNumber}
      onClose={onClose}
      title={orderNumber ? `Order ${orderNumber}` : "Order"}
      className="max-w-xl"
      footer={
        order && (
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <Button
                key={s}
                className="flex-1"
                loading={pending}
                onClick={() => act(() => updateOrderStatus({ orderId: order.id, to: s }))}
              >
                <Check className="size-4" aria-hidden /> {actionLabel(s)}
              </Button>
            ))}
            {canReject && (
              <Button
                variant="outline"
                className="text-danger"
                onClick={() => {
                  setReason("");
                  setReasonFor("REJECTED");
                }}
              >
                <Ban className="size-4" aria-hidden /> Reject
              </Button>
            )}
            {canCancel && !canReject && (
              <Button
                variant="outline"
                className="text-danger"
                onClick={() => {
                  setReason("");
                  setReasonFor("CANCELLED");
                }}
              >
                <Ban className="size-4" aria-hidden /> Cancel
              </Button>
            )}
          </div>
        )
      }
    >
      {error ? (
        <p className="text-danger">{error}</p>
      ) : !order ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {wholesale && <WholesaleBadge />}
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <span className="text-ink-muted">{formatDateTime(order.createdAt)}</span>
          </div>

          {/* Customer */}
          <section className="bg-cream-50 rounded-2xl p-4">
            {order.business ? (
              <Link
                href={`/admin/businesses/${order.business.id}`}
                className="text-brand-deep flex items-center gap-2 text-base font-bold hover:underline"
              >
                <Building2 className="size-4" aria-hidden /> {order.business.name}
              </Link>
            ) : (
              <p className="text-base font-bold">{order.customerName}</p>
            )}
            {order.business?.gstin && (
              <p className="text-ink-soft mt-0.5 font-mono text-xs">GSTIN {order.business.gstin}</p>
            )}
            {order.poNumber && (
              <p className="mt-1 text-sm font-semibold">
                PO {order.poNumber}
                {order.poDate ? ` · ${formatDate(order.poDate)}` : ""}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={`tel:+91${order.customerPhone}`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <Phone className="size-4" aria-hidden /> {order.customerPhone}
              </a>
              <a
                href={whatsappLink(`91${order.customerPhone}`, customerMessage(order, shopName))}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  size: "sm",
                  className: "bg-whatsapp hover:bg-whatsapp-dark",
                })}
              >
                <WhatsAppIcon className="size-4" /> Message
              </a>
            </div>
            {order.customerEmail && <p className="text-ink-soft mt-2">{order.customerEmail}</p>}
            <p className="mt-3 font-semibold">
              {order.fulfilment === "PICKUP"
                ? "Pickup at shop"
                : `Delivery${order.zone ? ` · ${order.zone}` : ""}`}
            </p>
            {order.fulfilment === "DELIVERY" && (
              <p className="text-ink-soft mt-1 flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {order.address}{" "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-deep font-bold underline"
                  >
                    Open in Maps
                  </a>
                </span>
              </p>
            )}
            {order.delivery && (
              <p className="mt-2 flex items-center gap-1.5 font-semibold">
                <CalendarDays className="text-ink-muted size-4" aria-hidden />{" "}
                {formatDate(order.delivery.scheduledDate)} ·{" "}
                {DELIVERY_SLOT_LABELS[order.delivery.slot]}
                {order.delivery.driverName ? ` · ${order.delivery.driverName}` : ""}
              </p>
            )}
            {order.delivery?.confirmedByBusinessAt && (
              <p className="text-brand-deep mt-1 text-xs font-semibold">
                Receipt confirmed by {order.delivery.receivedBy} on{" "}
                {formatDate(order.delivery.confirmedByBusinessAt)}
              </p>
            )}
            {order.notes && (
              <p className="bg-mango-soft mt-3 rounded-xl px-3 py-2 font-medium">
                📝 {order.notes}
              </p>
            )}
          </section>

          {/* Items */}
          <section>
            <h3 className="mb-2 font-bold">Items</h3>
            <ul className="divide-line border-line divide-y rounded-2xl border">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 p-3">
                  <span>
                    <span className="font-bold">
                      {i.quantity} × {i.productName}
                    </span>
                    <span className="text-ink-soft block text-xs">
                      {wholesale
                        ? `${i.size.toLowerCase()} · ${formatPaise(i.unitPrice)}/unit · GST ${formatRate(i.gstRateBps)}${i.hsnCode ? ` · HSN ${i.hsnCode}` : ""}`
                        : itemOptions({
                            size: i.size as Size,
                            sugarLevel: i.sugarLevel as Level,
                            iceLevel: i.iceLevel as Level,
                          }) || "Regular"}
                    </span>
                    {i.instructions && (
                      <span className="text-warning block text-xs font-semibold">
                        “{i.instructions}”
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">{formatPaise(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {wholesale ? (
              <WholesaleBill
                totals={order}
                fulfilment={order.fulfilment}
                placeOfSupply={order.placeOfSupply}
                amountPaid={order.amountPaid}
                className="mt-3"
              />
            ) : (
              <BillSummary
                totals={order}
                fulfilment={order.fulfilment}
                couponCode={order.couponCode}
                className="mt-3"
              />
            )}
          </section>

          {/* Wholesale payments & invoice */}
          {wholesale && (
            <section className="border-line rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-bold">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span> ·{" "}
                  <PaymentBadge status={order.paymentStatus} />
                </p>
                <span className="text-sm font-semibold tabular-nums">
                  {formatPaise(order.amountPaid)} of {formatPaise(order.total)} paid
                </span>
              </div>
              {order.payments.length > 0 && (
                <ul className="divide-line mt-3 divide-y text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 py-1.5">
                      <span>
                        {p.kind === "REFUND" ? "Refund" : PAYMENT_MODE_LABELS[p.mode]} ·{" "}
                        {formatDate(p.receivedAt)}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                      <span
                        className={
                          p.kind === "REFUND"
                            ? "text-danger font-semibold tabular-nums"
                            : "font-semibold tabular-nums"
                        }
                      >
                        {p.kind === "REFUND" ? "−" : ""}
                        {formatPaise(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {order.status !== "REJECTED" && (
                <PaymentForm
                  orderId={order.id}
                  balance={Math.max(0, order.total - order.amountPaid)}
                  paid={order.amountPaid}
                  canRefund={canRefund}
                  onDone={() => orderNumber && load(orderNumber).then(() => router.refresh())}
                />
              )}
              <div className="border-line mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                {order.invoice ? (
                  <>
                    <a
                      href={`/admin/print/invoice/${invoiceSlug(order.invoice.number)}`}
                      target="_blank"
                      rel="noopener"
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      <FileText className="size-4" aria-hidden /> Invoice {order.invoice.number}
                    </a>
                    <span className="text-ink-muted text-xs">
                      {order.invoice.status === "CANCELLED"
                        ? "Cancelled"
                        : `Due ${formatDate(order.invoice.dueDate)}`}
                    </span>
                  </>
                ) : (
                  order.status !== "PLACED" &&
                  order.status !== "CANCELLED" &&
                  order.status !== "REJECTED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={pending}
                      onClick={() => act(() => generateInvoice(order.id))}
                    >
                      <FileText className="size-4" aria-hidden /> Generate invoice
                    </Button>
                  )
                )}
              </div>
            </section>
          )}

          {/* Payment */}
          {!wholesale && (
            <section className="border-line rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-bold">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span> ·{" "}
                  <PaymentBadge status={order.paymentStatus} />
                </p>
                <div className="flex gap-2">
                  {order.paymentStatus === "PENDING" && order.status !== "REJECTED" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pending}
                      onClick={() => act(() => markOrderPaid(order.id))}
                    >
                      <Banknote className="size-4" aria-hidden /> Mark as paid
                    </Button>
                  )}
                  {canRefund && order.paymentStatus === "PAID" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReason("");
                        setReasonFor("REFUND");
                      }}
                    >
                      <Undo2 className="size-4" aria-hidden /> Refund
                    </Button>
                  )}
                </div>
              </div>
              {order.paidAt && (
                <p className="text-ink-muted mt-2 text-xs">
                  Paid {formatDateTime(order.paidAt)}
                  {order.paidBy ? ` · recorded by ${order.paidBy}` : ""}
                </p>
              )}
              {order.refundedAt && (
                <p className="text-ink-muted mt-1 text-xs">
                  Refunded {formatDateTime(order.refundedAt)}
                  {order.refundedBy ? ` · by ${order.refundedBy}` : ""}
                </p>
              )}
            </section>
          )}

          {/* History */}
          <section>
            <h3 className="mb-2 font-bold">History</h3>
            <ol className="space-y-2">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="bg-brand mt-1.5 size-2 shrink-0 rounded-full" aria-hidden />
                  <span>
                    <span className="font-semibold">
                      {h.fromStatus === h.toStatus
                        ? h.note
                        : statusLabel(h.toStatus, order.channel)}
                    </span>
                    <span className="text-ink-muted block text-xs">
                      {formatDateTime(h.createdAt)} · {h.by}
                      {h.note && h.fromStatus !== h.toStatus ? ` · ${h.note}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/admin/print/${order.orderNumber}`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Printer className="size-4" aria-hidden /> Print order slip
            </a>
            <Button size="sm" variant="ghost" onClick={() => orderNumber && load(orderNumber)}>
              <RotateCcw className="size-4" aria-hidden /> Refresh
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!reasonFor}
        onClose={() => setReasonFor(null)}
        title={
          reasonFor === "REJECTED"
            ? "Reject order"
            : reasonFor === "CANCELLED"
              ? "Cancel order"
              : "Refund order"
        }
        footer={
          <Button
            variant={reasonFor === "REFUND" ? "dark" : "danger"}
            className="w-full"
            loading={pending}
            onClick={() => {
              if (!order || !reasonFor) return;
              const r = reason;
              const kind = reasonFor;
              setReasonFor(null);
              act(() =>
                kind === "REFUND"
                  ? refundOrder(order.id, r)
                  : updateOrderStatus({ orderId: order.id, to: kind, note: r }),
              );
            }}
          >
            {reasonFor === "REJECTED"
              ? "Reject order"
              : reasonFor === "CANCELLED"
                ? "Cancel order"
                : "Record refund"}
          </Button>
        }
      >
        <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold">
          Reason{" "}
          {reasonFor !== "REFUND" && (
            <span className="text-ink-muted font-normal">(shown to the customer)</span>
          )}
        </label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={250}
          placeholder={
            reasonFor === "REFUND"
              ? "E.g. drink spilled in transit"
              : "E.g. Mango is out of stock today"
          }
        />
        {reasonFor === "CANCELLED" && (
          <p className="text-ink-muted mt-2 text-xs">
            {wholesale
              ? "Reserved finished stock goes back to its batches and any invoice is cancelled. Record refunds separately."
              : "Any stock used for this order will be added back to inventory."}
          </p>
        )}
      </Modal>
    </Drawer>
  );
}
