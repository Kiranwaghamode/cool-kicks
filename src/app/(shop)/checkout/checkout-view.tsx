"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, Banknote, Bike, CheckCircle2, Clock, Lock, Store } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { BillSummary } from "@/components/shop/bill-summary";
import { useValidatedCart } from "@/components/shop/use-validated-cart";
import { useCart } from "@/lib/cart-store";
import { checkoutSchema, indianMobile, type CheckoutForm } from "@/lib/validation";
import { checkPincode, placeOrder } from "@/server/actions/order";
import { getSavedCustomer, saveCustomer, saveLocalOrder } from "@/lib/local-orders";
import { formatPaise } from "@/lib/money";
import { ICE_LABELS, PAYMENT_METHOD_LABELS, SIZE_LABELS, SUGAR_LABELS, type Fulfilment } from "@/lib/types";
import { cn } from "@/lib/utils";

const IDEM_KEY = "coolkick-checkout-key";

function getIdempotencyKey() {
  try {
    let k = sessionStorage.getItem(IDEM_KEY);
    if (!k) {
      k = crypto.randomUUID();
      sessionStorage.setItem(IDEM_KEY, k);
    }
    return k;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutView() {
  const router = useRouter();
  const { hydrated, cart, error: cartError, refresh } = useValidatedCart();
  const lines = useCart((s) => s.lines);
  const fulfilment = useCart((s) => s.fulfilment);
  const setFulfilment = useCart((s) => s.setFulfilment);
  const couponCode = useCart((s) => s.couponCode);
  const setPincode = useCart((s) => s.setPincode);
  const storePincode = useCart((s) => s.pincode);
  const clearCart = useCart((s) => s.clear);

  const idemRef = useRef<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pinStatus, setPinStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [remember, setRemember] = useState(true);
  const [submitting, startSubmit] = useTransition();
  const placed = useRef(false);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      fulfilment: "PICKUP",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      area: "",
      pincode: "",
      paymentMethod: "PAY_AT_SHOP",
      notes: "",
    },
  });
  const { register, handleSubmit, formState, setValue, reset, setError, getValues, control } = form;
  const errors = formState.errors;
  const pincode = useWatch({ control, name: "pincode" }) ?? "";

  // Load the idempotency key once per checkout visit, and prefill saved details.
  useEffect(() => {
    idemRef.current = getIdempotencyKey();
    const saved = getSavedCustomer();
    reset({ ...getValues(), ...saved, pincode: saved.pincode || useCart.getState().pincode });
  }, [reset, getValues]);

  // Keep form fulfilment/payment in sync with the cart choice.
  useEffect(() => {
    setValue("fulfilment", fulfilment);
    setValue("paymentMethod", fulfilment === "DELIVERY" ? "CASH_ON_DELIVERY" : "PAY_AT_SHOP");
  }, [fulfilment, setValue]);

  // Live pincode check as soon as 6 digits are entered.
  useEffect(() => {
    if (fulfilment !== "DELIVERY") return;
    const pin = pincode.replace(/\D/g, "");
    if (pin !== storePincode) setPincode(pin);
    if (pin.length !== 6) {
      setPinStatus(null);
      return;
    }
    let cancelled = false;
    checkPincode(pin)
      .then((r) => !cancelled && setPinStatus(r))
      .catch(() => !cancelled && setPinStatus(null));
    return () => {
      cancelled = true;
    };
  }, [pincode, fulfilment, setPincode, storePincode]);

  if (!hydrated) {
    return (
      <div className="container-page py-10">
        <Skeleton className="mb-6 h-9 w-56" />
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <Skeleton className="h-[520px] w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (lines.length === 0 && !placed.current) {
    return (
      <div className="container-page py-10">
        <h1 className="sr-only">Checkout</h1>
        <div className="mx-auto max-w-lg rounded-[28px] bg-surface shadow-warm-soft">
          <EmptyState
            title="Your cart is empty"
            description="Add some drinks before checking out."
            action={<LinkButton href="/menu">Browse the menu</LinkButton>}
          />
        </div>
      </div>
    );
  }

  const shop = cart?.shop;
  const totals = cart?.totals;
  const paymentOptions =
    fulfilment === "DELIVERY"
      ? [{ value: "CASH_ON_DELIVERY" as const, label: "Cash on Delivery", enabled: shop?.codEnabled ?? true, icon: Banknote, hint: "Pay cash or UPI when your order arrives" }]
      : [{ value: "PAY_AT_SHOP" as const, label: "Pay at Shop", enabled: shop?.payAtShopEnabled ?? true, icon: Store, hint: "Pay by cash or UPI at the counter" }];

  const blocked =
    !cart ||
    !cart.shop.status.isOpen ||
    cart.lines.some((l) => !l.available) ||
    !cart.totals.meetsMinimum ||
    (fulfilment === "DELIVERY" && (!pinStatus?.ok || !cart.zone)) ||
    paymentOptions.every((p) => !p.enabled);

  function onValid() {
    setSubmitError(null);
    setReviewOpen(true);
  }

  function confirmOrder() {
    const details = getValues();
    startSubmit(async () => {
      const res = await placeOrder({
        idempotencyKey: idemRef.current ?? getIdempotencyKey(),
        cart: {
          lines: lines.map((l) => ({
            key: l.key,
            productId: l.productId,
            size: l.size,
            sugar: l.sugar,
            ice: l.ice,
            instructions: l.instructions,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          couponCode,
          fulfilment,
        },
        details,
      }).catch(() => ({ ok: false as const, error: "Network problem – your details are kept. Please try again.", refreshCart: false }));

      if (res.ok) {
        placed.current = true;
        if (remember) {
          saveCustomer({
            customerName: details.customerName,
            customerPhone: details.customerPhone,
            customerEmail: details.customerEmail,
            addressLine1: details.addressLine1,
            addressLine2: details.addressLine2,
            landmark: details.landmark,
            area: details.area,
            pincode: details.pincode,
          });
        }
        saveLocalOrder({ orderNumber: res.orderNumber, phone: res.phone });
        try {
          sessionStorage.removeItem(IDEM_KEY);
        } catch {}
        clearCart();
        router.replace(`/order/${res.orderNumber}/confirmed`);
        return;
      }
      setReviewOpen(false);
      setSubmitError(res.error);
      if ("fieldErrors" in res && res.fieldErrors) {
        for (const [path, message] of Object.entries(res.fieldErrors)) {
          setError(path as keyof CheckoutForm, { message });
        }
      }
      if (res.refreshCart) refresh();
      toast.error("Order not placed", res.error);
    });
  }

  const inputProps = (name: keyof CheckoutForm) => ({
    id: `co-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `co-${name}-error` : undefined,
    ...register(name),
  });

  return (
    <div className="container-page pt-6 pb-44 md:py-10">
      <Link href="/cart" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-brand-deep">
        <ArrowLeft className="size-4" aria-hidden /> Back to cart
      </Link>
      <h1 className="mb-6 text-headline-sm font-extrabold md:text-headline">Checkout</h1>

      {cart && !cart.shop.status.isOpen && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
          <Clock className="size-4 shrink-0 text-mango" aria-hidden /> {cart.shop.status.message}. Orders can&apos;t be placed right now.
        </p>
      )}
      {(submitError || cartError) && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {submitError ?? cartError}
        </p>
      )}

      <form id="checkout-form" noValidate onSubmit={handleSubmit(onValid)} className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-5">
          {/* 1. Details */}
          <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6" aria-labelledby="co-details">
            <h2 id="co-details" className="mb-4 flex items-center gap-2 text-lg font-bold">
              <StepDot n={1} /> Your details
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" htmlFor="co-customerName" error={errors.customerName?.message} required>
                <Input {...inputProps("customerName")} autoComplete="name" placeholder="Your name" />
              </Field>
              <Field label="Mobile number" htmlFor="co-customerPhone" error={errors.customerPhone?.message} hint="For order updates" required>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-[15px] font-semibold text-ink-soft">+91</span>
                  <Input
                    {...inputProps("customerPhone")}
                    className="pl-14"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={16}
                    placeholder="98765 43210"
                  />
                </div>
              </Field>
              <Field label="Email" htmlFor="co-customerEmail" error={errors.customerEmail?.message} hint="Optional" className="md:col-span-2">
                <Input {...inputProps("customerEmail")} type="email" autoComplete="email" placeholder="you@example.com" />
              </Field>
            </div>
          </section>

          {/* 2. Fulfilment */}
          <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6" aria-labelledby="co-fulfil">
            <h2 id="co-fulfil" className="mb-4 flex items-center gap-2 text-lg font-bold">
              <StepDot n={2} /> Pickup or delivery
            </h2>
            <SegmentedControl
              label="Pickup or delivery"
              value={fulfilment}
              onChange={(v: Fulfilment) => setFulfilment(v)}
              options={[
                { value: "PICKUP", label: "Pickup", hint: "Collect at shop", disabled: shop ? !shop.pickupEnabled : false },
                { value: "DELIVERY", label: "Home Delivery", hint: "To your door", disabled: shop ? !shop.deliveryEnabled : false },
              ]}
            />

            {fulfilment === "DELIVERY" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Pincode" htmlFor="co-pincode" error={errors.pincode?.message} required>
                  <Input {...inputProps("pincode")} inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="411005" />
                </Field>
                <div className="flex items-end pb-3 md:pb-3.5" aria-live="polite">
                  {pinStatus && (
                    <p className={cn("flex items-center gap-1.5 text-sm font-semibold", pinStatus.ok ? "text-brand-deep" : "text-danger")}>
                      {pinStatus.ok ? <Bike className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
                      {pinStatus.message}
                    </p>
                  )}
                </div>
                <Field label="House / flat, street" htmlFor="co-addressLine1" error={errors.addressLine1?.message} required className="md:col-span-2">
                  <Input {...inputProps("addressLine1")} autoComplete="address-line1" placeholder="Flat 4B, Sunrise Apartments, Lane 3" />
                </Field>
                <Field label="Address line 2" htmlFor="co-addressLine2" hint="Optional" className="md:col-span-2">
                  <Input {...inputProps("addressLine2")} autoComplete="address-line2" />
                </Field>
                <Field label="Landmark" htmlFor="co-landmark" hint="Optional">
                  <Input {...inputProps("landmark")} placeholder="Near Café Goodluck" />
                </Field>
                <Field label="Area" htmlFor="co-area" error={errors.area?.message} required>
                  <Input {...inputProps("area")} autoComplete="address-level3" placeholder="Shivajinagar" />
                </Field>
              </div>
            ) : (
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-cream-50 px-4 py-3 text-sm text-ink-soft">
                <Store className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden />
                Collect your order at our counter. We&apos;ll have it ready in about 15–20 minutes.
              </p>
            )}
          </section>

          {/* 3. Payment */}
          <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6" aria-labelledby="co-pay">
            <h2 id="co-pay" className="mb-4 flex items-center gap-2 text-lg font-bold">
              <StepDot n={3} /> Payment
            </h2>
            <div role="radiogroup" aria-label="Payment method" className="space-y-3">
              {paymentOptions.map(({ value, label, enabled, icon: Icon, hint }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition has-[:checked]:border-brand has-[:checked]:bg-brand-soft/60",
                    !enabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input type="radio" value={value} disabled={!enabled} {...register("paymentMethod")} className="size-5 accent-brand" />
                  <Icon className="size-6 text-brand-deep" aria-hidden />
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="block text-sm text-ink-soft">{enabled ? hint : "Not available right now"}</span>
                  </span>
                </label>
              ))}
              <p className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">
                <Lock className="size-4" aria-hidden /> Online payment (UPI, cards) coming soon
              </p>
              {errors.paymentMethod && <p className="text-sm font-medium text-danger">{errors.paymentMethod.message}</p>}
            </div>
          </section>

          <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6">
            <Field label="Order notes" htmlFor="co-notes" hint="Optional – anything we should know?">
              <Textarea {...inputProps("notes")} maxLength={300} placeholder="Ring the bell twice, extra napkins…" />
            </Field>
            <label className="mt-4 flex items-center gap-3 text-sm font-medium">
              <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember my details on this device
            </label>
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-28" aria-label="Order summary">
          <div className="rounded-card bg-surface p-5 shadow-warm-soft">
            <h2 className="mb-3 font-bold">Order summary</h2>
            <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto pr-1 text-sm">
              {(cart?.lines ?? []).map((l) => (
                <li key={l.key} className={cn("flex justify-between gap-3", !l.available && "text-danger line-through")}>
                  <span>
                    <span className="font-semibold">{l.quantity} × {l.name}</span>
                    <span className="block text-xs text-ink-muted">{SIZE_LABELS[l.size]}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatPaise(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {totals ? (
              <BillSummary
                totals={totals}
                fulfilment={fulfilment}
                couponCode={cart?.coupon?.applied ? cart.coupon.code : null}
                deliveryKnown={fulfilment === "PICKUP" || !!cart?.zone}
              />
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
            {cart?.coupon && !cart.coupon.applied && (
              <p className="mt-3 text-sm font-medium text-warning">{cart.coupon.message}</p>
            )}
            {cart && !cart.totals.meetsMinimum && (
              <p className="mt-3 text-sm font-medium text-warning">
                Minimum order {formatPaise(cart.shop.minOrderAmount)} – add {formatPaise(cart.totals.minOrderShortfall)} more.
              </p>
            )}
            <div className="mt-5 hidden lg:block">
              <Button type="submit" size="lg" className="w-full" disabled={blocked} loading={submitting}>
                Review &amp; place order
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile sticky bar */}
        <div className="glass fixed inset-x-0 bottom-[68px] z-30 border-t border-white/70 px-4 py-3 shadow-sheet lg:hidden">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-ink-soft">To pay</p>
              <p className="text-lg font-extrabold tabular-nums">{totals ? formatPaise(totals.total) : "…"}</p>
            </div>
            <Button type="submit" size="lg" className="flex-1" disabled={blocked} loading={submitting}>
              Review order
            </Button>
          </div>
        </div>
      </form>

      <Modal
        open={reviewOpen}
        onClose={() => !submitting && setReviewOpen(false)}
        title="Confirm your order"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setReviewOpen(false)} disabled={submitting}>
              Edit
            </Button>
            <Button className="flex-[2]" size="lg" onClick={confirmOrder} loading={submitting} data-place-order>
              {submitting ? "Placing order…" : `Place order · ${totals ? formatPaise(totals.total) : ""}`}
            </Button>
          </div>
        }
      >
        <ReviewDetails
          values={getValues()}
          lines={cart?.lines ?? []}
          totals={totals}
          coupon={cart?.coupon?.applied ? cart.coupon.code : null}
        />
      </Modal>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden>
      {n}
    </span>
  );
}

function ReviewDetails({
  values,
  lines,
  totals,
  coupon,
}: {
  values: CheckoutForm;
  lines: NonNullable<ReturnType<typeof useValidatedCart>["cart"]>["lines"];
  totals: NonNullable<ReturnType<typeof useValidatedCart>["cart"]>["totals"] | undefined;
  coupon: string | null;
}) {
  const delivery = values.fulfilment === "DELIVERY";
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-2xl bg-cream-50 p-4">
        <p className="font-bold">{values.customerName}</p>
        <p className="text-ink-soft">+91 {indianMobile.safeParse(values.customerPhone).data ?? values.customerPhone}</p>
        <p className="mt-2 flex items-start gap-2 text-ink-soft">
          {delivery ? <Bike className="mt-0.5 size-4 text-brand-deep" aria-hidden /> : <Store className="mt-0.5 size-4 text-brand-deep" aria-hidden />}
          {delivery
            ? [values.addressLine1, values.addressLine2, values.landmark, values.area, values.pincode].filter(Boolean).join(", ")
            : "Pickup from the shop"}
        </p>
        <p className="mt-1 flex items-center gap-2 text-ink-soft">
          <CheckCircle2 className="size-4 text-brand-deep" aria-hidden /> {PAYMENT_METHOD_LABELS[values.paymentMethod]}
        </p>
      </div>
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span>
              <span className="font-semibold">{l.quantity} × {l.name}</span>
              <span className="block text-xs text-ink-muted">
                {[SIZE_LABELS[l.size], SUGAR_LABELS[l.sugar], ICE_LABELS[l.ice]].join(" · ")}
                {l.instructions ? ` · “${l.instructions}”` : ""}
              </span>
            </span>
            <span className="font-semibold tabular-nums">{formatPaise(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      {totals && <BillSummary totals={totals} fulfilment={values.fulfilment} couponCode={coupon} />}
    </div>
  );
}
