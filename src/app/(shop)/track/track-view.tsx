"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Bike, PackageSearch, RefreshCw, RotateCcw, Star, Store } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { WhatsAppIcon } from "@/components/shop/icons";
import { OrderTimeline } from "@/components/shop/order-timeline";
import { BillSummary } from "@/components/shop/bill-summary";
import { getReorderItems, submitReview, trackOrder } from "@/server/actions/tracking";
import type { CustomerOrder } from "@/server/orders";
import { getLocalOrders } from "@/lib/local-orders";
import { useCart } from "@/lib/cart-store";
import { ACTIVE_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { estimatedTime, formatDateTime, formatTime, itemOptions } from "@/lib/order-format";
import { formatPaise } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;

export function TrackView({
  initialOrderNumber,
  whatsappNumber,
  prepMins,
}: {
  initialOrderNumber: string;
  whatsappNumber: string;
  prepMins: number;
}) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  /** The number + phone of the order currently shown (set only after a successful lookup). */
  const [creds, setCreds] = useState<{ orderNumber: string; phone: string } | null>(null);

  const lookup = useCallback((num: string, ph: string, silent = false) => {
    startTransition(async () => {
      const res = await trackOrder({ orderNumber: num, phone: ph }).catch(() => ({
        ok: false as const,
        error: "Network problem – please try again.",
      }));
      if (res.ok) {
        setOrder(res.order);
        setError(null);
        setLastChecked(new Date());
        setCreds({ orderNumber: num, phone: ph });
        setPhone((p) => p || ph);
      } else if (!silent) {
        setOrder(null);
        setError(res.error);
      }
    });
  }, []);

  // Orders placed on this device can be tracked without typing the phone again.
  useEffect(() => {
    if (!initialOrderNumber) return;
    const saved = getLocalOrders().find((o) => o.orderNumber === initialOrderNumber);
    if (saved) lookup(saved.orderNumber, saved.phone);
  }, [initialOrderNumber, lookup]);

  // Auto-refresh while the order is active.
  const active = order ? ACTIVE_STATUSES.includes(order.status) : false;
  useEffect(() => {
    if (!active || !creds) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") lookup(creds.orderNumber, creds.phone, true);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [active, creds, lookup]);

  return (
    <div className="container-page py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-tangerine uppercase">Order status</p>
          <h1 className="mt-1 text-headline-sm font-extrabold md:text-headline">Track your order</h1>
          <p className="mt-1 text-ink-soft">Enter your order number and the phone number you ordered with.</p>
        </header>

        <form
          className="grid gap-4 rounded-card bg-surface p-5 shadow-warm-soft md:grid-cols-[1fr_1fr_auto] md:items-end md:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            lookup(orderNumber.trim().toUpperCase(), phone);
          }}
        >
          <Field label="Order number" htmlFor="track-order">
            <Input
              id="track-order"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="CK-20431"
              autoCapitalize="characters"
              required
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Phone number" htmlFor="track-phone">
            <Input
              id="track-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              required
            />
          </Field>
          <Button type="submit" size="lg" loading={pending && !order} className="md:h-12">
            <PackageSearch className="size-5" aria-hidden /> Track
          </Button>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger md:col-span-3">
              {error}
            </p>
          )}
        </form>

        {order && (
          <OrderDetails
            order={order}
            phone={creds?.phone ?? phone}
            whatsappNumber={whatsappNumber}
            prepMins={prepMins}
            lastChecked={lastChecked}
            refreshing={pending}
            onRefresh={() => creds && lookup(creds.orderNumber, creds.phone, true)}
          />
        )}
      </div>
    </div>
  );
}

function OrderDetails({
  order,
  phone,
  whatsappNumber,
  prepMins,
  lastChecked,
  refreshing,
  onRefresh,
}: {
  order: CustomerOrder;
  phone: string;
  whatsappNumber: string;
  prepMins: number;
  lastChecked: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const addToCart = useCart((s) => s.add);
  const [reordering, startReorder] = useTransition();
  const active = ACTIVE_STATUSES.includes(order.status);
  const eta = estimatedTime(order.createdAt, order.fulfilment, prepMins);
  const isPickup = order.fulfilment === "PICKUP";

  function reorder() {
    startReorder(async () => {
      const res = await getReorderItems({ orderNumber: order.orderNumber, phone });
      if (!res.ok) return toast.error("Couldn't reorder", res.error);
      for (const l of res.lines) addToCart(l);
      if (res.skipped.length) toast.info("Some items were skipped", `${res.skipped.join(", ")} ${res.skipped.length === 1 ? "is" : "are"} unavailable right now.`);
      if (res.lines.length) {
        toast.success("Added to your cart", `${res.lines.length} item${res.lines.length === 1 ? "" : "s"} from ${order.orderNumber}`);
        router.push("/cart");
      }
    });
  }

  return (
    <div className="mt-6 grid gap-5 md:grid-cols-[1.1fr_1fr]">
      <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6" aria-labelledby="status-h">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-extrabold tracking-wider text-brand-deep">{order.orderNumber}</p>
            <p className="text-sm text-ink-soft">Placed {formatDateTime(order.createdAt)}</p>
          </div>
          <Badge tone={order.status === "CANCELLED" || order.status === "REJECTED" ? "danger" : order.status === "DELIVERED" ? "success" : "mango"} className="text-xs">
            {STATUS_LABELS[order.status]}
          </Badge>
        </div>
        <h2 id="status-h" className="sr-only">
          Order progress
        </h2>
        {active && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl bg-cream-50 px-4 py-3 text-sm">
            {isPickup ? <Store className="size-4 text-brand-deep" aria-hidden /> : <Bike className="size-4 text-brand-deep" aria-hidden />}
            {isPickup ? "Estimated ready by" : "Estimated arrival"} <strong>~{formatTime(eta.at)}</strong>
          </p>
        )}
        <OrderTimeline status={order.status} fulfilment={order.fulfilment} history={order.history} cancelReason={order.cancelReason} />
        {active && (
          <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
            Updates every 30 seconds{lastChecked ? ` · last checked ${formatTime(lastChecked)}` : ""}
            <button type="button" onClick={onRefresh} className="font-semibold text-brand-deep underline-offset-2 hover:underline">
              Refresh now
            </button>
          </p>
        )}
      </section>

      <div className="space-y-5">
        <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6" aria-labelledby="items-h">
          <h2 id="items-h" className="mb-3 font-bold">Items</h2>
          <ul className="mb-4 space-y-2.5 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-semibold">
                    {i.quantity} × {i.productName}
                  </span>
                  <span className="block text-xs text-ink-muted">{itemOptions(i)}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatPaise(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <BillSummary totals={order} fulfilment={order.fulfilment} couponCode={order.couponCode} />
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Badge tone="neutral">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</Badge>
            <Badge tone={order.paymentStatus === "PAID" ? "success" : order.paymentStatus === "REFUNDED" ? "ice" : "warning"}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </Badge>
          </div>
        </section>

        <div className="grid gap-3">
          <a
            href={whatsappLink(whatsappNumber, `Hi Cool Kick! I need help with my order ${order.orderNumber}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg", className: "bg-whatsapp hover:bg-whatsapp-dark" })}
          >
            <WhatsAppIcon className="size-5" /> Need help? Chat on WhatsApp
          </a>
          <Button variant="outline" size="lg" onClick={reorder} loading={reordering}>
            <RotateCcw className="size-5" aria-hidden /> Reorder these items
          </Button>
        </div>

        {order.status === "DELIVERED" && !order.hasReview && <ReviewForm orderNumber={order.orderNumber} phone={phone} />}
      </div>
    </div>
  );
}

function ReviewForm({ orderNumber, phone }: { orderNumber: string; phone: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="rounded-card bg-brand-soft p-5 text-center font-semibold text-brand-deep">{done}</p>;
  return (
    <form
      className="rounded-card bg-surface p-5 shadow-warm-soft"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitReview({ orderNumber, phone, rating, comment });
          if (res.ok) setDone(res.message);
          else toast.error("Review not sent", res.message);
        });
      }}
    >
      <h2 className="font-bold">How was your order?</h2>
      <div role="radiogroup" aria-label="Rating" className="my-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="rounded-full p-1"
          >
            <Star className={cn("size-8", n <= rating ? "fill-mango text-mango" : "text-line-strong")} aria-hidden />
          </button>
        ))}
      </div>
      <label htmlFor="review-comment" className="sr-only">
        Your review
      </label>
      <Textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Tell us what you loved…" required />
      <Button type="submit" className="mt-3 w-full" loading={pending}>
        Submit review
      </Button>
    </form>
  );
}
