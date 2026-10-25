import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Bike, CheckCircle2, Clock, CreditCard, Home, MapPinned, Store } from "lucide-react";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/shop/copy-button";
import { WhatsAppIcon } from "@/components/shop/icons";
import { BillSummary } from "@/components/shop/bill-summary";
import { ConfirmationEffects } from "./effects";
import { Confetti } from "@/components/shop/motion/confetti";
import { getCustomerOrder } from "@/server/orders";
import { isRecentOrder } from "@/server/recent-orders";
import { getShopSettings } from "@/server/settings";
import { estimatedTime, formatTime, itemOptions, orderWhatsappText } from "@/lib/order-format";
import { formatPaise } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function OrderConfirmedPage({ params }: PageProps<"/order/[orderNumber]/confirmed">) {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw).toUpperCase();
  // Only the browser that placed the order sees it here; everyone else must use number + phone.
  if (!/^CK-\d{4,8}$/.test(orderNumber) || !(await isRecentOrder(orderNumber))) {
    redirect(`/track?order=${encodeURIComponent(orderNumber)}`);
  }
  const [order, settings] = await Promise.all([getCustomerOrder(orderNumber), getShopSettings()]);
  if (!order) redirect("/track");

  const eta = estimatedTime(order.createdAt, order.fulfilment, settings.estimatedPrepMins);
  const isPickup = order.fulfilment === "PICKUP";

  return (
    <div className="container-page py-8 md:py-14">
      <ConfirmationEffects />
      <Confetti />
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[28px] bg-surface p-6 text-center shadow-warm md:p-10">
          <div className="mx-auto flex size-20 animate-pop items-center justify-center rounded-full bg-brand text-white shadow-glow motion-safe:animate-[pop_600ms_ease-out]" data-success-badge>
            <CheckCircle2 className="size-11" aria-hidden />
          </div>
          <h1 className="mt-5 text-headline-sm font-extrabold md:text-headline">Order placed!</h1>
          <p className="mt-2 text-ink-soft md:text-lg">
            Thanks {order.customerName}! We&apos;ve got your order and will confirm it shortly.
          </p>

          <div className="mx-auto mt-6 flex max-w-sm items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/60 p-3 pl-5">
            <div className="text-left">
              <p className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">Order number</p>
              <p className="font-mono text-2xl font-extrabold tracking-wider text-brand-deep">{order.orderNumber}</p>
            </div>
            <CopyButton value={order.orderNumber} />
          </div>

          <dl className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            <div className="rounded-2xl bg-cream-50 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <Clock className="size-4" aria-hidden /> {isPickup ? "Ready by" : "Arriving by"}
              </dt>
              <dd className="mt-1 font-bold">
                ~{formatTime(eta.at)} <span className="font-medium text-ink-muted">({eta.mins} min)</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-cream-50 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                {isPickup ? <Store className="size-4" aria-hidden /> : <Bike className="size-4" aria-hidden />} Fulfilment
              </dt>
              <dd className="mt-1 font-bold">{isPickup ? "Pickup at shop" : `Delivery${order.area ? ` · ${order.area}` : ""}`}</dd>
            </div>
            <div className="rounded-2xl bg-cream-50 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <CreditCard className="size-4" aria-hidden /> Payment
              </dt>
              <dd className="mt-1 font-bold">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
              <dd className="mt-1">
                <Badge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>
              </dd>
            </div>
          </dl>
        </div>

        <section className="mt-5 rounded-card bg-surface p-5 shadow-warm-soft md:p-6" aria-labelledby="items-h">
          <h2 id="items-h" className="mb-3 font-bold">Your items</h2>
          <ul className="mb-4 space-y-2.5 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-semibold">
                    {i.quantity} × {i.productName}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {itemOptions(i)}
                    {i.instructions ? ` · “${i.instructions}”` : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatPaise(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <BillSummary totals={order} fulfilment={order.fulfilment} couponCode={order.couponCode} />
          {!isPickup && (
            <p className="mt-4 text-sm text-ink-soft">Please keep {formatPaise(order.total)} ready in cash or UPI for the delivery partner.</p>
          )}
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <LinkButton href={`/track?order=${order.orderNumber}`} size="lg">
            <MapPinned className="size-5" aria-hidden /> Track order
          </LinkButton>
          <a
            href={whatsappLink(settings.whatsappNumber, orderWhatsappText(order))}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg", className: "bg-[#25D366] hover:bg-[#1ebe5b]" })}
          >
            <WhatsAppIcon className="size-5" /> Send on WhatsApp
          </a>
          <LinkButton href="/" variant="outline" size="lg">
            <Home className="size-5" aria-hidden /> Back to home
          </LinkButton>
        </div>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Want more?{" "}
          <a href="/menu" className="inline-flex items-center gap-1 font-bold text-brand-deep hover:underline">
            Order another round <ArrowRight className="size-4" aria-hidden />
          </a>
        </p>
      </div>
    </div>
  );
}
