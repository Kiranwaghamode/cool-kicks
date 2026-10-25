"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Switch, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { saveSettings, type SettingsInput } from "@/server/actions/admin/config";
import { WEEKDAYS, WEEKDAY_LABELS, type OpeningHours } from "@/lib/shop-hours";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";

type Form = Omit<SettingsInput, "openingHours" | "minOrderAmount"> & { openingHours: OpeningHours; minOrderAmount: number };

export function SettingsForm({ initial }: { initial: Form }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(initial);
  const [minOrder, setMinOrder] = useState(String(paiseToRupees(initial.minOrderAmount)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof Form) => ({
    id: `st-${k}`,
    value: String(f[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    "aria-invalid": errors[k as string] ? true : undefined,
  });

  return (
    <form
      noValidate
      className="grid gap-5 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings({ ...f, minOrderAmount: rupeesToPaise(Number(minOrder) || 0) });
          if (res.ok) {
            toast.success(res.message ?? "Saved");
            setErrors({});
            router.refresh();
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error("Not saved", res.error);
          }
        });
      }}
    >
      <Panel title="Shop details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Shop name" htmlFor="st-shopName" error={errors.shopName}>
            <Input {...text("shopName")} />
          </Field>
          <Field label="Tagline" htmlFor="st-tagline">
            <Input {...text("tagline")} />
          </Field>
          <Field label="Phone" htmlFor="st-phone" error={errors.phone} hint="Shown on the site, e.g. +919876543210">
            <Input {...text("phone")} type="tel" />
          </Field>
          <Field label="WhatsApp number" htmlFor="st-whatsappNumber" error={errors.whatsappNumber} hint="Digits with country code: 919876543210">
            <Input {...text("whatsappNumber")} inputMode="numeric" />
          </Field>
          <Field label="Email" htmlFor="st-email" error={errors.email} className="md:col-span-2">
            <Input {...text("email")} type="email" />
          </Field>
          <Field label="Address" htmlFor="st-address" error={errors.address} className="md:col-span-2">
            <Textarea {...text("address")} />
          </Field>
          <Field label="Google Maps link (directions)" htmlFor="st-mapLink" error={errors.mapLink} className="md:col-span-2" hint="Open your shop in Google Maps → Share → Copy link">
            <Input {...text("mapLink")} placeholder="https://maps.app.goo.gl/…" />
          </Field>
          <Field label="Google Maps embed URL" htmlFor="st-mapEmbedUrl" error={errors.mapEmbedUrl} className="md:col-span-2" hint="Google Maps → Share → Embed a map → copy only the src=&quot;…&quot; URL">
            <Input {...text("mapEmbedUrl")} placeholder="https://www.google.com/maps/embed?pb=…" />
          </Field>
          <Field label="Instagram URL" htmlFor="st-instagramUrl" error={errors.instagramUrl}>
            <Input {...text("instagramUrl")} />
          </Field>
          <Field label="Facebook URL" htmlFor="st-facebookUrl" error={errors.facebookUrl}>
            <Input {...text("facebookUrl")} />
          </Field>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Opening hours (India time)">
          <ul className="space-y-2">
            {WEEKDAYS.map((d) => {
              const h = f.openingHours[d];
              const upd = (patch: Partial<typeof h>) => set("openingHours", { ...f.openingHours, [d]: { ...h, ...patch } });
              return (
                <li key={d} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-2 text-sm">
                  <span className="font-semibold">{WEEKDAY_LABELS[d]}</span>
                  <label className="sr-only" htmlFor={`open-${d}`}>
                    {WEEKDAY_LABELS[d]} opens
                  </label>
                  <Input id={`open-${d}`} type="time" value={h.open} disabled={h.closed} onChange={(e) => upd({ open: e.target.value })} className="h-10 px-3" />
                  <label className="sr-only" htmlFor={`close-${d}`}>
                    {WEEKDAY_LABELS[d]} closes
                  </label>
                  <Input id={`close-${d}`} type="time" value={h.close} disabled={h.closed} onChange={(e) => upd({ close: e.target.value })} className="h-10 px-3" />
                  <label className="flex items-center gap-1.5 text-xs font-semibold">
                    <Checkbox checked={h.closed} onChange={(e) => upd({ closed: e.target.checked })} /> Closed
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">To stay open past midnight, set a closing time earlier than the opening time (e.g. 10:00 → 01:00).</p>
        </Panel>

        <Panel title="Temporary closure">
          <label className="flex items-center justify-between font-semibold">
            Close the shop for online orders now
            <Switch checked={f.isTemporarilyClosed} onChange={(v) => set("isTemporarilyClosed", v)} label="Temporarily closed" />
          </label>
          <Field label="Message shown to customers" htmlFor="st-closureMessage" className="mt-4">
            <Input {...text("closureMessage")} placeholder="Closed for Diwali – back on Monday!" />
          </Field>
        </Panel>

        <Panel title="Ordering">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum order (₹)" htmlFor="st-min" error={errors.minOrderAmount}>
              <Input id="st-min" type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            </Field>
            <Field label="Preparation time (minutes)" htmlFor="st-prep" error={errors.estimatedPrepMins}>
              <Input id="st-prep" type="number" min={5} max={180} value={f.estimatedPrepMins} onChange={(e) => set("estimatedPrepMins", Number(e.target.value))} />
            </Field>
          </div>
          <div className="mt-4 space-y-3">
            {(
              [
                ["pickupEnabled", "Pickup orders"],
                ["deliveryEnabled", "Home delivery"],
                ["payAtShopEnabled", "Pay at Shop (pickup)"],
                ["codEnabled", "Cash on Delivery"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between font-semibold">
                {label}
                <Switch checked={!!f[k]} onChange={(v) => set(k, v)} label={label} />
              </label>
            ))}
          </div>
        </Panel>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          <Save className="size-5" aria-hidden /> Save settings
        </Button>
      </div>
    </form>
  );
}
