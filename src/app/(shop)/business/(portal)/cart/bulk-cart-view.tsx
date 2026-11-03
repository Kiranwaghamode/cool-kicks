"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Minus, Plus, ScrollText, ShoppingCart, Trash2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { WholesaleBill } from "@/components/shop/business/wholesale-bill";
import { useValidatedBulkCart } from "@/components/shop/business/use-validated-bulk-cart";
import { useBulkCart } from "@/lib/bulk-cart-store";
import { formatPaise } from "@/lib/money";
import { SIZE_LABELS } from "@/lib/types";
import { requestQuotation } from "@/server/actions/business/quotations";

export type CartAddress = { id: string; label: string; line1: string; area: string; city: string; pincode: string; isDefault: boolean };

/** Choose a sensible default address once addresses are known. */
export function useDefaultAddress(addresses: CartAddress[]) {
  const addressId = useBulkCart((s) => s.addressId);
  const setAddressId = useBulkCart((s) => s.setAddressId);
  useEffect(() => {
    if (!addresses.some((a) => a.id === addressId)) setAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  }, [addresses, addressId, setAddressId]);
}

export function FulfilmentPicker({ addresses }: { addresses: CartAddress[] }) {
  const fulfilment = useBulkCart((s) => s.fulfilment);
  const setFulfilment = useBulkCart((s) => s.setFulfilment);
  const addressId = useBulkCart((s) => s.addressId);
  const setAddressId = useBulkCart((s) => s.setAddressId);
  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Delivery or pickup"
        value={fulfilment}
        onChange={setFulfilment}
        options={[
          { value: "DELIVERY", label: "Delivery" },
          { value: "PICKUP", label: "Pickup from shop" },
        ]}
      />
      {fulfilment === "DELIVERY" &&
        (addresses.length ? (
          <Field label="Deliver to" htmlFor="bc-address">
            <Select id="bc-address" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} – {a.area}, {a.city} {a.pincode}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="rounded-2xl bg-mango-soft px-4 py-3 text-sm font-semibold text-warning">
            Add a delivery address in your{" "}
            <Link href="/business/profile" className="underline">
              profile
            </Link>{" "}
            first.
          </p>
        ))}
    </div>
  );
}

export function BulkCartView({ addresses }: { addresses: CartAddress[] }) {
  const router = useRouter();
  const lines = useBulkCart((s) => s.lines);
  const setQuantity = useBulkCart((s) => s.setQuantity);
  const remove = useBulkCart((s) => s.remove);
  const clear = useBulkCart((s) => s.clear);
  const fulfilment = useBulkCart((s) => s.fulfilment);
  const addressId = useBulkCart((s) => s.addressId);
  const { hydrated, cart, error, loading } = useValidatedBulkCart();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  useDefaultAddress(addresses);

  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Your bulk cart is empty"
        description="Add cases from the wholesale catalogue, or repeat a past order."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/business/catalogue">Browse catalogue</LinkButton>
            <LinkButton href="/business/orders" variant="outline">
              Past orders
            </LinkButton>
          </div>
        }
      />
    );
  }

  const priced = new Map(cart?.lines.map((l) => [l.variantId, l]));

  function submitQuote() {
    start(async () => {
      const res = await requestQuotation({
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        fulfilment,
        addressId: fulfilment === "DELIVERY" ? addressId : "",
        note,
      });
      if (res.ok && res.data) {
        toast.success("Quotation requested", "We'll send you prices shortly.");
        clear();
        setQuoteOpen(false);
        router.push(`/business/quotations/${res.data.number}`);
      } else if (!res.ok) toast.error("Couldn't send request", res.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="bc-title" className="rounded-card bg-surface p-4 shadow-warm-soft md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 id="bc-title" className="text-2xl font-extrabold">
            Bulk cart
          </h1>
          <Button size="sm" variant="ghost" className="text-danger" onClick={clear}>
            <Trash2 className="size-4" aria-hidden /> Clear
          </Button>
        </div>
        <ul className="divide-y divide-line">
          {lines.map((l) => {
            const p = priced.get(l.variantId);
            const step = Math.max(1, l.packSize);
            return (
              <li key={l.variantId} className="flex flex-wrap gap-4 py-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-cream">{l.image && <Image src={l.image} alt="" fill sizes="64px" className="object-cover" />}</div>
                <div className="min-w-40 flex-1">
                  <p className="font-bold">{l.name}</p>
                  <p className="text-xs text-ink-muted">
                    {SIZE_LABELS[l.size]} · {l.volumeMl} ml · {l.packaging || `pack of ${l.packSize}`} · MOQ {l.moq}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold tabular-nums">{formatPaise(p?.unitPrice ?? l.unitPrice)}</span>
                    <span className="text-ink-muted"> / unit</span>
                    {p && p.tierDiscountBps > 0 && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-deep">{p.tierDiscountBps / 100}% volume discount</span>}
                    {p?.special && <span className="ml-2 rounded-full bg-mango-soft px-2 py-0.5 text-xs font-bold text-warning">Special price</span>}
                  </p>
                  {p?.problem && <p className="mt-1 text-sm font-semibold text-danger">{p.problem}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-full border border-line-strong">
                    <button type="button" aria-label={`Fewer ${l.name}`} onClick={() => setQuantity(l.variantId, l.quantity - step < l.moq ? 0 : l.quantity - step)} className="flex size-9 items-center justify-center rounded-full hover:bg-cream">
                      {l.quantity - step < l.moq ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                    </button>
                    <label htmlFor={`bq-${l.variantId}`} className="sr-only">
                      Quantity of {l.name}
                    </label>
                    <input
                      id={`bq-${l.variantId}`}
                      type="number"
                      inputMode="numeric"
                      min={l.moq}
                      step={step}
                      defaultValue={l.quantity}
                      key={l.quantity}
                      onBlur={(e) => setQuantity(l.variantId, Number(e.target.value) || l.moq)}
                      className="w-20 bg-transparent text-center font-bold tabular-nums outline-none"
                    />
                    <button type="button" aria-label={`More ${l.name}`} onClick={() => setQuantity(l.variantId, l.quantity + step)} className="flex size-9 items-center justify-center rounded-full hover:bg-cream">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="w-24 text-right font-bold tabular-nums">{p ? formatPaise(p.lineTotal) : "…"}</span>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${l.name}`} onClick={() => remove(l.variantId)} className="size-9">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <LinkButton href="/business/catalogue" variant="outline" size="sm" className="mt-2">
          <Plus className="size-4" aria-hidden /> Add more products
        </LinkButton>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card bg-surface p-5 shadow-warm-soft">
          <FulfilmentPicker addresses={addresses} />
          <div className="mt-5">
            {cart ? (
              <WholesaleBill totals={cart.totals} fulfilment={cart.fulfilment} deliveryKnown={cart.fulfilment === "PICKUP" || !!cart.address} placeOfSupply={cart.placeOfSupply} />
            ) : (
              <Skeleton className="h-40" />
            )}
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
          {cart && cart.problems.length > 0 && (
            <ul className="mt-4 space-y-1.5 rounded-2xl bg-mango-soft p-3 text-sm font-medium text-warning" role="status">
              {cart.problems.map((p) => (
                <li key={p} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {p}
                </li>
              ))}
            </ul>
          )}
          <LinkButton
            href="/business/checkout"
            size="lg"
            className="mt-5 w-full"
            aria-disabled={!cart?.canOrder || loading}
            onClick={(e) => {
              if (!cart?.canOrder || loading) e.preventDefault();
            }}
          >
            Checkout <ArrowRight className="size-5" aria-hidden />
          </LinkButton>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setQuoteOpen(true)}>
            <ScrollText className="size-4" aria-hidden /> Request a quotation instead
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">For special prices, very large quantities or delivery outside our zones.</p>
        </div>
      </aside>

      <Modal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        title="Request a quotation"
        footer={
          <Button className="w-full" loading={pending} onClick={submitQuote}>
            Send request
          </Button>
        }
      >
        <p className="text-sm text-ink-soft">
          We&apos;ll review the {lines.length} item{lines.length === 1 ? "" : "s"} in your cart and send you a quote, usually within one working day. Your cart will be
          cleared.
        </p>
        <Field label="Anything we should know?" htmlFor="q-note" className="mt-4" hint="Target price, delivery timing, special packaging…">
          <Textarea id="q-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
