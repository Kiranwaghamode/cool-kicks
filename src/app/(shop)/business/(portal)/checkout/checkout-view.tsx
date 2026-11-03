"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { CheckoutFields, paymentChoices, type CheckoutDetails } from "@/components/shop/business/checkout-fields";
import { WholesaleBill } from "@/components/shop/business/wholesale-bill";
import { useValidatedBulkCart } from "@/components/shop/business/use-validated-bulk-cart";
import { useBulkCart } from "@/lib/bulk-cart-store";
import { formatPaise } from "@/lib/money";
import { SIZE_LABELS } from "@/lib/types";
import { placeWholesaleOrder } from "@/server/actions/business/orders";
import { FulfilmentPicker, useDefaultAddress, type CartAddress } from "../cart/bulk-cart-view";

const IDEM_KEY = "coolkick-b2b-checkout-key";

function idempotencyKey() {
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

export function WholesaleCheckoutView({ addresses }: { addresses: CartAddress[] }) {
  const router = useRouter();
  const lines = useBulkCart((s) => s.lines);
  const fulfilment = useBulkCart((s) => s.fulfilment);
  const addressId = useBulkCart((s) => s.addressId);
  const clear = useBulkCart((s) => s.clear);
  const { hydrated, cart, options, error, loading, refresh } = useValidatedBulkCart();
  const [draft, setDraft] = useState<CheckoutDetails | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, start] = useTransition();
  const [placed, setPlaced] = useState(false);
  useDefaultAddress(addresses);

  // Defaults until the user edits; the payment choice is kept valid as totals change.
  const details = useMemo<CheckoutDetails | null>(() => {
    if (!options || !cart) return null;
    const base = draft ?? { scheduledDate: options.earliestDate, slot: "MORNING", paymentMethod: "BANK_TRANSFER", poNumber: "", poDate: "", notes: "" };
    const choices = paymentChoices(cart.fulfilment, cart.totals.total, options);
    if (choices.some((c) => c.value === base.paymentMethod && !c.disabled)) return base;
    return { ...base, paymentMethod: choices.find((c) => !c.disabled)?.value ?? "BANK_TRANSFER" };
  }, [draft, options, cart]);

  if (!hydrated || (!cart && !error)) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (lines.length === 0 && !placed) {
    return <EmptyState title="Nothing to check out" description="Your bulk cart is empty." action={<LinkButton href="/business/catalogue">Browse catalogue</LinkButton>} />;
  }

  function placeOrder() {
    if (!details || !cart) return;
    setSubmitError(null);
    start(async () => {
      const res = await placeWholesaleOrder({
        idempotencyKey: idempotencyKey(),
        cart: { lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })), fulfilment, addressId: fulfilment === "DELIVERY" ? addressId : "" },
        details: { ...details, fulfilment, addressId: fulfilment === "DELIVERY" ? addressId : "" },
      });
      if (res.ok && res.data) {
        setPlaced(true);
        try {
          sessionStorage.removeItem(IDEM_KEY);
        } catch {}
        clear();
        toast.success("Order placed", `Order ${res.data.orderNumber} has been sent to our team.`);
        router.push(`/business/orders/${res.data.orderNumber}?placed=1`);
      } else if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setSubmitError(res.error);
        if (res.refreshCart) refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-7">
        <Link href="/business/cart" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Back to cart
        </Link>
        <h1 className="mb-5 text-2xl font-extrabold">Checkout</h1>
        <div className="mb-6">
          <FulfilmentPicker addresses={addresses} />
        </div>
        {details && options && cart ? (
          <CheckoutFields value={details} onChange={setDraft} fulfilment={cart.fulfilment} total={cart.totals.total} options={options} errors={errors} />
        ) : (
          <Skeleton className="h-80" />
        )}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card bg-surface p-5 shadow-warm-soft">
          <h2 className="mb-3 font-bold">Order summary</h2>
          <ul className="mb-4 space-y-1.5 text-sm">
            {cart?.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3">
                <span>
                  {l.quantity} × {l.name} <span className="text-ink-muted">({SIZE_LABELS[l.size]})</span>
                </span>
                <span className="tabular-nums">{formatPaise(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          {cart && <WholesaleBill totals={cart.totals} fulfilment={cart.fulfilment} deliveryKnown={cart.fulfilment === "PICKUP" || !!cart.address} placeOfSupply={cart.placeOfSupply} />}
          {(error || (cart && cart.problems.length > 0)) && (
            <ul className="mt-4 space-y-1.5 rounded-2xl bg-mango-soft p-3 text-sm font-medium text-warning" role="status">
              {[...(error ? [error] : []), ...(cart?.problems ?? [])].map((p) => (
                <li key={p} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {p}
                </li>
              ))}
            </ul>
          )}
          {submitError && (
            <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              {submitError}
            </p>
          )}
          <Button size="lg" className="mt-5 w-full" loading={placing} disabled={!cart?.canOrder || loading || !details} onClick={placeOrder}>
            <Lock className="size-4" aria-hidden /> Place order · {cart ? formatPaise(cart.totals.total) : "…"}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">Prices and GST are confirmed by our server when you place the order.</p>
        </div>
      </aside>
    </div>
  );
}
