"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Bike,
  Clock,
  GlassWater,
  Plus,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BillSummary } from "@/components/shop/bill-summary";
import { useValidatedCart } from "@/components/shop/use-validated-cart";
import { useCart, MAX_LINE_QUANTITY } from "@/lib/cart-store";
import { formatPaise } from "@/lib/money";
import { ICE_LABELS, SIZE_LABELS, SUGAR_LABELS, type Fulfilment } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CartView() {
  const { hydrated, cart, error, loading } = useValidatedCart();
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const fulfilment = useCart((s) => s.fulfilment);
  const setFulfilment = useCart((s) => s.setFulfilment);
  const couponCode = useCart((s) => s.couponCode);
  const setCouponCode = useCart((s) => s.setCouponCode);
  const pincode = useCart((s) => s.pincode);
  const setPincode = useCart((s) => s.setPincode);
  const [couponInput, setCouponInput] = useState("");

  if (!hydrated) return <CartSkeleton />;

  if (lines.length === 0) {
    return (
      <div className="container-page py-10">
        <h1 className="sr-only">Your cart</h1>
        <div className="mx-auto max-w-lg rounded-[28px] bg-surface shadow-warm-soft">
          <EmptyState
            icon={<GlassWater />}
            title="Your cart is empty"
            description="Nothing chilling here yet. Add a juice, mojito or falooda to get started."
            action={
              <LinkButton href="/menu" size="lg">
                Browse the menu <ArrowRight className="size-5" aria-hidden />
              </LinkButton>
            }
          />
        </div>
      </div>
    );
  }

  const pricedByKey = new Map(cart?.lines.map((l) => [l.key, l]));
  const problemsByKey = new Map(cart?.problems.filter((p) => p.key).map((p) => [p.key!, p.message]));
  const generalProblems = cart?.problems.filter((p) => !p.key) ?? [];
  const totals = cart?.totals;
  const shop = cart?.shop;
  const unavailableCount = cart?.lines.filter((l) => !l.available).length ?? 0;

  const fulfilmentOptions = [
    { value: "PICKUP" as Fulfilment, label: "Pickup", hint: "Collect at shop", disabled: shop ? !shop.pickupEnabled : false },
    { value: "DELIVERY" as Fulfilment, label: "Delivery", hint: "To your door", disabled: shop ? !shop.deliveryEnabled : false },
  ];

  const canCheckout =
    !!cart &&
    cart.shop.status.isOpen &&
    unavailableCount === 0 &&
    cart.totals.meetsMinimum &&
    (fulfilment === "PICKUP" ? cart.shop.pickupEnabled : cart.shop.deliveryEnabled && cart.deliverable !== false);

  const blockReason = !cart
    ? null
    : !cart.shop.status.isOpen
      ? cart.shop.status.message
      : unavailableCount
        ? "Remove unavailable items to continue"
        : !cart.totals.meetsMinimum
          ? `Add ${formatPaise(cart.totals.minOrderShortfall)} more to reach the minimum order of ${formatPaise(cart.shop.minOrderAmount)}`
          : fulfilment === "DELIVERY" && cart.deliverable === false
            ? "We don't deliver to this pincode yet – try pickup"
            : null;

  return (
    <div className="container-page pt-6 pb-44 md:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-sm font-extrabold md:text-headline">Your Cart</h1>
          <p className="text-ink-soft">
            {lines.reduce((n, l) => n + l.quantity, 0)} item{lines.length === 1 && lines[0].quantity === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/menu" className="inline-flex items-center gap-1 text-sm font-bold text-brand-deep hover:underline">
          <Plus className="size-4" aria-hidden /> Add more items
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {cart && !cart.shop.status.isOpen && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
          <Clock className="size-4 shrink-0 text-mango" aria-hidden /> {cart.shop.status.message} – ordering is paused until then.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
        {/* Lines */}
        <section aria-label="Cart items" className="space-y-3">
          <ul className="space-y-3">
            {lines.map((l) => {
              const priced = pricedByKey.get(l.key);
              const problem = problemsByKey.get(l.key);
              const unavailable = priced ? !priced.available : false;
              const options = [
                SIZE_LABELS[l.size],
                l.sugar !== "REGULAR" ? SUGAR_LABELS[l.sugar] : null,
                l.ice !== "REGULAR" ? ICE_LABELS[l.ice] : null,
              ].filter(Boolean);
              return (
                <li
                  key={l.key}
                  className={cn(
                    "flex gap-3 rounded-card bg-surface p-3 shadow-warm-soft md:gap-4 md:p-4",
                    unavailable && "ring-2 ring-danger/30",
                  )}
                >
                  <Link href={`/product/${l.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-cream md:size-24">
                    {l.image && (
                      <Image src={l.image} alt="" fill sizes="96px" className={cn("object-cover", unavailable && "grayscale")} />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/product/${l.slug}`} className="line-clamp-1 font-bold hover:text-brand-deep">
                          {l.name}
                        </Link>
                        <p className="text-sm text-ink-soft">{options.join(" · ")}</p>
                        {l.instructions && <p className="line-clamp-1 text-xs text-ink-muted italic">“{l.instructions}”</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(l.key)}
                        aria-label={`Remove ${l.name}`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {problem && (
                      <p className={cn("mt-1 flex items-center gap-1 text-xs font-semibold", unavailable ? "text-danger" : "text-warning")}>
                        <AlertTriangle className="size-3.5" aria-hidden /> {problem}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <QuantityStepper
                        size="sm"
                        value={l.quantity}
                        min={1}
                        max={MAX_LINE_QUANTITY}
                        onChange={(q) => setQuantity(l.key, q)}
                        label={`Quantity of ${l.name}`}
                      />
                      <span className="font-extrabold tabular-nums">
                        {priced ? (unavailable ? "—" : formatPaise(priced.lineTotal)) : formatPaise(l.unitPrice * l.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-28" aria-label="Order summary">
          <div className="rounded-card bg-surface p-5 shadow-warm-soft">
            <h2 className="mb-3 font-bold">How would you like it?</h2>
            <SegmentedControl label="Pickup or delivery" value={fulfilment} onChange={setFulfilment} options={fulfilmentOptions} />
            {fulfilment === "DELIVERY" && (
              <div className="mt-4">
                <label htmlFor="cart-pincode" className="mb-1.5 block pl-1 text-sm font-semibold">
                  Delivery pincode
                </label>
                <Input
                  id="cart-pincode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  placeholder="6-digit pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  aria-invalid={cart?.deliverable === false || undefined}
                  aria-describedby="cart-pincode-status"
                />
                <p id="cart-pincode-status" className="mt-1.5 pl-1 text-sm" aria-live="polite">
                  {pincode.length === 6 && cart?.deliverable === false && (
                    <span className="font-medium text-danger">Sorry, we don&apos;t deliver here yet.</span>
                  )}
                  {cart?.zone && (
                    <span className="font-medium text-brand-deep">
                      <Bike className="mr-1 inline size-4" aria-hidden />
                      We deliver here · {cart.zone.name}
                    </span>
                  )}
                </p>
              </div>
            )}
            {fulfilment === "PICKUP" && (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <Store className="size-4 text-brand-deep" aria-hidden /> Ready in about 15–20 minutes at our counter.
              </p>
            )}
          </div>

          <div className="rounded-card bg-surface p-5 shadow-warm-soft">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <BadgePercent className="size-5 text-tangerine" aria-hidden /> Coupon
            </h2>
            {couponCode ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand/50 bg-brand-soft px-4 py-3">
                <div>
                  <p className="font-mono font-extrabold tracking-widest text-brand-deep">{couponCode}</p>
                  <p className={cn("text-sm", cart?.coupon?.applied ? "text-brand-deep" : "text-warning")} aria-live="polite">
                    {cart?.coupon?.applied
                      ? `You save ${formatPaise(cart.totals.discount)}`
                      : (cart?.coupon?.message ?? "Checking…")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCouponCode("")}
                  aria-label="Remove coupon"
                  className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (couponInput.trim()) setCouponCode(couponInput);
                  setCouponInput("");
                }}
              >
                <label htmlFor="coupon" className="sr-only">
                  Coupon code
                </label>
                <Input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Enter code e.g. JUICY10"
                  className="font-mono uppercase"
                  autoCapitalize="characters"
                />
                <Button type="submit" variant="dark" disabled={!couponInput.trim()}>
                  Apply
                </Button>
              </form>
            )}
            <Link href="/offers" className="mt-2 inline-block pl-1 text-sm font-semibold text-brand-deep hover:underline">
              View available offers
            </Link>
          </div>

          <div className="rounded-card bg-surface p-5 shadow-warm-soft">
            <h2 className="mb-3 font-bold">Bill summary</h2>
            {totals ? (
              <BillSummary
                totals={totals}
                fulfilment={fulfilment}
                couponCode={cart?.coupon?.applied ? cart.coupon.code : null}
                deliveryKnown={fulfilment === "PICKUP" || !!cart?.zone}
                className={cn(loading && "opacity-60 transition-opacity")}
              />
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-7 w-full" />
              </div>
            )}

            {totals && fulfilment === "DELIVERY" && cart?.zone && (totals.freeDeliveryShortfall ?? 0) > 0 && (
              <p className="mt-4 rounded-2xl bg-ice px-4 py-2.5 text-sm font-semibold text-ice-deep">
                Add {formatPaise(totals.freeDeliveryShortfall!)} more for FREE delivery 🚚
              </p>
            )}
            {totals && !totals.meetsMinimum && cart && (
              <p className="mt-4 rounded-2xl bg-mango-soft px-4 py-2.5 text-sm font-semibold text-warning">
                Minimum order is {formatPaise(cart.shop.minOrderAmount)} – add {formatPaise(totals.minOrderShortfall)} more.
              </p>
            )}
            {generalProblems.map((p) => (
              <p key={p.message} className="mt-3 text-sm font-medium text-danger">
                {p.message}
              </p>
            ))}

            <div className="mt-5 hidden lg:block">
              <CheckoutButton enabled={canCheckout} reason={blockReason} />
            </div>
            <p className="mt-3 text-center text-xs text-ink-muted">Prices are confirmed by our server at checkout.</p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="glass fixed inset-x-0 bottom-[68px] z-30 border-t border-white/70 px-4 py-3 shadow-sheet lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">To pay</p>
            <p className="text-lg font-extrabold tabular-nums">{totals ? formatPaise(totals.total) : "…"}</p>
          </div>
          <CheckoutButton enabled={canCheckout} reason={blockReason} compact />
        </div>
      </div>
    </div>
  );
}

function CheckoutButton({ enabled, reason, compact }: { enabled: boolean; reason: string | null; compact?: boolean }) {
  return (
    <div className={cn(compact ? "flex-1" : "w-full")}>
      {enabled ? (
        <LinkButton href="/checkout" size="lg" className="w-full">
          Proceed to checkout <ArrowRight className="size-5" aria-hidden />
        </LinkButton>
      ) : (
        <Button size="lg" className="w-full" disabled>
          {compact ? "Checkout" : "Proceed to checkout"}
        </Button>
      )}
      {!enabled && reason && (
        <p className={cn("mt-1.5 text-center text-xs font-medium text-danger", compact && "line-clamp-1")}>{reason}</p>
      )}
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="container-page py-10" aria-busy="true">
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
