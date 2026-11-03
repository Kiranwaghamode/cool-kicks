"use client";

import { Banknote, CalendarDays, CreditCard, Landmark, Store } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatPaise } from "@/lib/money";
import { DELIVERY_SLOT_LABELS, DELIVERY_SLOTS, type DeliverySlot, type Fulfilment, type WholesalePaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CheckoutDetails = {
  scheduledDate: string;
  slot: DeliverySlot;
  paymentMethod: WholesalePaymentMethod;
  poNumber: string;
  poDate: string;
  notes: string;
};

export type CheckoutFieldOptions = {
  credit: { isActive: boolean; available: number; limit: number; days: number; overdue: number };
  codEnabled: boolean;
  payAtShopEnabled: boolean;
  earliestDate: string;
  latestDate: string;
};

/** Which payment methods can be used, and why not. */
export function paymentChoices(fulfilment: Fulfilment, total: number, o: CheckoutFieldOptions) {
  const creditReason = !o.credit.isActive
    ? "Not enabled for your account"
    : total > o.credit.available
      ? `Over your available credit (${formatPaise(o.credit.available)})`
      : null;
  return [
    {
      value: "CREDIT" as const,
      label: `On credit · pay in ${o.credit.days} days`,
      hint: creditReason ?? `Available credit ${formatPaise(o.credit.available)}`,
      icon: CreditCard,
      disabled: !!creditReason,
    },
    { value: "BANK_TRANSFER" as const, label: "Bank transfer / UPI in advance", hint: "We dispatch once payment is received", icon: Landmark, disabled: false },
    ...(fulfilment === "DELIVERY"
      ? [{ value: "CASH_ON_DELIVERY" as const, label: "Cash / UPI on delivery", hint: o.codEnabled ? "Pay the driver on delivery" : "Not available right now", icon: Banknote, disabled: !o.codEnabled }]
      : [{ value: "PAY_AT_SHOP" as const, label: "Pay at the shop", hint: o.payAtShopEnabled ? "Pay when you collect" : "Not available right now", icon: Store, disabled: !o.payAtShopEnabled }]),
  ];
}

export function CheckoutFields({
  value,
  onChange,
  fulfilment,
  total,
  options,
  errors,
}: {
  value: CheckoutDetails;
  onChange: (v: CheckoutDetails) => void;
  fulfilment: Fulfilment;
  total: number;
  options: CheckoutFieldOptions;
  errors: Record<string, string>;
}) {
  const set = <K extends keyof CheckoutDetails>(k: K, v: CheckoutDetails[K]) => onChange({ ...value, [k]: v });
  const choices = paymentChoices(fulfilment, total, options);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <CalendarDays className="size-5 text-brand-deep" aria-hidden /> {fulfilment === "DELIVERY" ? "Delivery date" : "Pickup date"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <Field label="Date" htmlFor="co-date" error={errors.scheduledDate}>
            <Input id="co-date" type="date" min={options.earliestDate} max={options.latestDate} value={value.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} />
          </Field>
          <div>
            <p className="mb-1.5 pl-1 text-sm font-semibold">Time slot</p>
            <SegmentedControl label="Time slot" value={value.slot} onChange={(v) => set("slot", v)} options={DELIVERY_SLOTS.map((s) => ({ value: s, label: DELIVERY_SLOT_LABELS[s].split(" ")[0], hint: DELIVERY_SLOT_LABELS[s].split(" ")[1] }))} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Payment</h2>
        <div role="radiogroup" aria-label="Payment method" className="grid gap-2">
          {choices.map((c) => (
            <label
              key={c.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] p-4 transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand",
                value.paymentMethod === c.value ? "border-brand bg-brand-soft/40" : "border-line-strong bg-surface hover:border-brand/50",
                c.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input type="radio" name="paymentMethod" value={c.value} checked={value.paymentMethod === c.value} disabled={c.disabled} onChange={() => set("paymentMethod", c.value)} className="sr-only" />
              <c.icon className="size-5 shrink-0 text-brand-deep" aria-hidden />
              <span>
                <span className="block font-bold">{c.label}</span>
                <span className="block text-sm text-ink-muted">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.paymentMethod && <p className="mt-2 text-sm font-medium text-danger">{errors.paymentMethod}</p>}
        {options.credit.overdue > 0 && <p className="mt-2 text-sm font-semibold text-danger">You have {formatPaise(options.credit.overdue)} overdue. Please clear it soon.</p>}
      </section>

      <section>
        <h2 className="mb-3 font-bold">Purchase order (optional)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your PO number" htmlFor="co-po" error={errors.poNumber}>
            <Input id="co-po" value={value.poNumber} maxLength={40} onChange={(e) => set("poNumber", e.target.value)} placeholder="PO/2026/118" />
          </Field>
          <Field label="PO date" htmlFor="co-podate" error={errors.poDate}>
            <Input id="co-podate" type="date" value={value.poDate} onChange={(e) => set("poDate", e.target.value)} />
          </Field>
          <Field label="Notes for our team" htmlFor="co-notes" className="sm:col-span-2">
            <Textarea id="co-notes" value={value.notes} maxLength={500} onChange={(e) => set("notes", e.target.value)} placeholder="Gate timings, unloading instructions…" />
          </Field>
        </div>
      </section>
    </div>
  );
}
