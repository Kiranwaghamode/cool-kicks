"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Ban, Banknote, Check, MapPin, Phone, Printer, RotateCcw, Undo2 } from "lucide-react";
import { Drawer, Modal } from "@/components/ui/modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { WhatsAppIcon } from "@/components/shop/icons";
import { BillSummary } from "@/components/shop/bill-summary";
import { PaymentBadge, StatusBadge } from "@/components/admin/ui";
import { getAdminOrder, markOrderPaid, refundOrder, updateOrderStatus, type AdminOrder } from "@/server/actions/admin/orders";
import { allowedTransitions, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { formatDateTime, itemOptions } from "@/lib/order-format";
import { formatPaise } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type Level, type Size } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Accept order",
  PREPARING: "Start preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered",
};

function customerMessage(o: AdminOrder) {
  const name = o.customerName.split(" ")[0];
  const map: Record<OrderStatus, string> = {
    PLACED: `Hi ${name}! We've received your Cool Kick order ${o.orderNumber}. We'll confirm it shortly.`,
    CONFIRMED: `Hi ${name}! Your Cool Kick order ${o.orderNumber} is confirmed 🍹`,
    PREPARING: `Hi ${name}! We're preparing your order ${o.orderNumber} right now.`,
    READY_FOR_PICKUP: `Hi ${name}! Your order ${o.orderNumber} is ready for pickup at the counter. Total ${formatPaise(o.total)}.`,
    OUT_FOR_DELIVERY: `Hi ${name}! Your order ${o.orderNumber} is out for delivery. Please keep ${formatPaise(o.total)} ready (cash/UPI).`,
    DELIVERED: `Hi ${name}! Hope you enjoyed your Cool Kick order ${o.orderNumber}. Thank you! 💚`,
    CANCELLED: `Hi ${name}, your order ${o.orderNumber} has been cancelled${o.cancelReason ? `: ${o.cancelReason}` : ""}. Sorry for the trouble.`,
    REJECTED: `Hi ${name}, sorry – we couldn't accept order ${o.orderNumber}${o.cancelReason ? `: ${o.cancelReason}` : ""}.`,
  };
  return map[o.status];
}

export function OrderDrawer({ orderNumber, canRefund, onClose }: { orderNumber: string | null; canRefund: boolean; onClose: () => void }) {
  const router = useRouter();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [reasonFor, setReasonFor] = useState<"REJECTED" | "CANCELLED" | "REFUND" | null>(null);
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

  const next = order ? allowedTransitions(order.status, order.fulfilment).filter((s) => s !== "CANCELLED" && s !== "REJECTED") : [];
  const canReject = order?.status === "PLACED";
  const canCancel = order ? allowedTransitions(order.status, order.fulfilment).includes("CANCELLED") : false;

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
              <Button key={s} className="flex-1" loading={pending} onClick={() => act(() => updateOrderStatus({ orderId: order.id, to: s }))}>
                <Check className="size-4" aria-hidden /> {ACTION_LABELS[s] ?? STATUS_LABELS[s]}
              </Button>
            ))}
            {canReject && (
              <Button variant="outline" className="text-danger" onClick={() => { setReason(""); setReasonFor("REJECTED"); }}>
                <Ban className="size-4" aria-hidden /> Reject
              </Button>
            )}
            {canCancel && !canReject && (
              <Button variant="outline" className="text-danger" onClick={() => { setReason(""); setReasonFor("CANCELLED"); }}>
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
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <span className="text-ink-muted">{formatDateTime(order.createdAt)}</span>
          </div>

          {/* Customer */}
          <section className="rounded-2xl bg-cream-50 p-4">
            <p className="text-base font-bold">{order.customerName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:+91${order.customerPhone}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                <Phone className="size-4" aria-hidden /> {order.customerPhone}
              </a>
              <a
                href={whatsappLink(`91${order.customerPhone}`, customerMessage(order))}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "sm", className: "bg-whatsapp hover:bg-whatsapp-dark" })}
              >
                <WhatsAppIcon className="size-4" /> Message
              </a>
            </div>
            {order.customerEmail && <p className="mt-2 text-ink-soft">{order.customerEmail}</p>}
            <p className="mt-3 font-semibold">{order.fulfilment === "PICKUP" ? "Pickup at shop" : `Delivery${order.zone ? ` · ${order.zone}` : ""}`}</p>
            {order.fulfilment === "DELIVERY" && (
              <p className="mt-1 flex items-start gap-1.5 text-ink-soft">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {order.address}{" "}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-deep underline">
                    Open in Maps
                  </a>
                </span>
              </p>
            )}
            {order.notes && <p className="mt-3 rounded-xl bg-mango-soft px-3 py-2 font-medium">📝 {order.notes}</p>}
          </section>

          {/* Items */}
          <section>
            <h3 className="mb-2 font-bold">Items</h3>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 p-3">
                  <span>
                    <span className="font-bold">
                      {i.quantity} × {i.productName}
                    </span>
                    <span className="block text-xs text-ink-soft">{itemOptions({ size: i.size as Size, sugarLevel: i.sugarLevel as Level, iceLevel: i.iceLevel as Level }) || "Regular"}</span>
                    {i.instructions && <span className="block text-xs font-semibold text-warning">“{i.instructions}”</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{formatPaise(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <BillSummary totals={order} fulfilment={order.fulfilment} couponCode={order.couponCode} className="mt-3" />
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-bold">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span> · <PaymentBadge status={order.paymentStatus} />
              </p>
              <div className="flex gap-2">
                {order.paymentStatus === "PENDING" && order.status !== "REJECTED" && (
                  <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => markOrderPaid(order.id))}>
                    <Banknote className="size-4" aria-hidden /> Mark as paid
                  </Button>
                )}
                {canRefund && order.paymentStatus === "PAID" && (
                  <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonFor("REFUND"); }}>
                    <Undo2 className="size-4" aria-hidden /> Refund
                  </Button>
                )}
              </div>
            </div>
            {order.paidAt && <p className="mt-2 text-xs text-ink-muted">Paid {formatDateTime(order.paidAt)}{order.paidBy ? ` · recorded by ${order.paidBy}` : ""}</p>}
            {order.refundedAt && <p className="mt-1 text-xs text-ink-muted">Refunded {formatDateTime(order.refundedAt)}{order.refundedBy ? ` · by ${order.refundedBy}` : ""}</p>}
          </section>

          {/* History */}
          <section>
            <h3 className="mb-2 font-bold">History</h3>
            <ol className="space-y-2">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>
                    <span className="font-semibold">{h.fromStatus === h.toStatus ? h.note : STATUS_LABELS[h.toStatus]}</span>
                    <span className="block text-xs text-ink-muted">
                      {formatDateTime(h.createdAt)} · {h.by}
                      {h.note && h.fromStatus !== h.toStatus ? ` · ${h.note}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap gap-2">
            <a href={`/admin/print/${order.orderNumber}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
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
        title={reasonFor === "REJECTED" ? "Reject order" : reasonFor === "CANCELLED" ? "Cancel order" : "Refund order"}
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
              act(() => (kind === "REFUND" ? refundOrder(order.id, r) : updateOrderStatus({ orderId: order.id, to: kind, note: r })));
            }}
          >
            {reasonFor === "REJECTED" ? "Reject order" : reasonFor === "CANCELLED" ? "Cancel order" : "Record refund"}
          </Button>
        }
      >
        <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold">
          Reason {reasonFor !== "REFUND" && <span className="font-normal text-ink-muted">(shown to the customer)</span>}
        </label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={250}
          placeholder={reasonFor === "REFUND" ? "E.g. drink spilled in transit" : "E.g. Mango is out of stock today"}
        />
        {reasonFor === "CANCELLED" && <p className="mt-2 text-xs text-ink-muted">Any stock used for this order will be added back to inventory.</p>}
      </Modal>
    </Drawer>
  );
}
