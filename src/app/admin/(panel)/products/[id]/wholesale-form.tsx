"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatRate, GST_RATES_BPS } from "@/lib/gst";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { SIZE_LABELS, type Size } from "@/lib/types";
import { saveProductWholesale } from "@/server/actions/admin/catalog";

type VariantRow = {
  variantId: string;
  size: Size;
  volumeMl: number;
  retailPrice: number;
  wholesaleEnabled: boolean;
  wholesalePrice: number | null;
  moq: number;
  packSize: number;
  packaging: string;
  tiers: { minQuantity: number; discountBps: number }[];
};

type Draft = Omit<VariantRow, "wholesalePrice" | "moq" | "packSize" | "tiers"> & {
  price: string;
  moq: string;
  packSize: string;
  tiers: { min: string; pct: string }[];
};

const toDraft = (v: VariantRow): Draft => ({
  ...v,
  price: v.wholesalePrice !== null ? String(paiseToRupees(v.wholesalePrice)) : "",
  moq: String(v.moq),
  packSize: String(v.packSize),
  tiers: v.tiers.map((t) => ({ min: String(t.minQuantity), pct: String(t.discountBps / 100) })),
});

export function WholesaleForm({ productId, gstRateBps, hsnCode, variants }: { productId: string; gstRateBps: number; hsnCode: string; variants: VariantRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gst, setGst] = useState(gstRateBps);
  const [hsn, setHsn] = useState(hsnCode);
  const [rows, setRows] = useState(variants.map(toDraft));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const upd = (i: number, patch: Partial<Draft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function save() {
    start(async () => {
      const res = await saveProductWholesale({
        productId,
        gstRateBps: gst as 0 | 500 | 1200 | 1800 | 2800,
        hsnCode: hsn,
        variants: rows.map((r) => ({
          variantId: r.variantId,
          wholesaleEnabled: r.wholesaleEnabled,
          wholesalePrice: r.price ? rupeesToPaise(Number(r.price) || 0) : null,
          moq: Math.round(Number(r.moq) || 0),
          packSize: Math.round(Number(r.packSize) || 0),
          packaging: r.packaging,
          tiers: r.tiers.filter((t) => t.min || t.pct).map((t) => ({ minQuantity: Math.round(Number(t.min) || 0), discountBps: Math.round((Number(t.pct) || 0) * 100) })),
        })),
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setErrors({});
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error("Not saved", res.error);
      }
    });
  }

  return (
    <Panel
      title="Wholesale (B2B)"
      className="mt-6"
      action={
        <Button size="sm" onClick={save} loading={pending}>
          <Save className="size-4" aria-hidden /> Save wholesale
        </Button>
      }
    >
      <p className="mb-4 text-sm text-ink-soft">
        Wholesale prices are per unit and <strong>exclude GST</strong>. They are shown only to approved business accounts. Price lists and special prices are
        applied on top of these.
      </p>
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Field label="GST rate" htmlFor="ws-gst" hint="Used on wholesale invoices">
          <Select id="ws-gst" value={gst} onChange={(e) => setGst(Number(e.target.value))}>
            {GST_RATES_BPS.map((r) => (
              <option key={r} value={r}>
                {formatRate(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="HSN code" htmlFor="ws-hsn" error={errors.hsnCode} hint="e.g. 2009 for fruit juices">
          <Input id="ws-hsn" inputMode="numeric" value={hsn} onChange={(e) => setHsn(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        </Field>
      </div>

      <div className="space-y-4">
        {rows.map((r, i) => (
          <fieldset key={r.variantId} className="rounded-2xl border border-line p-4">
            <legend className="sr-only">{SIZE_LABELS[r.size]}</legend>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">
                {SIZE_LABELS[r.size]} · {r.volumeMl} ml <span className="font-normal text-ink-muted">· retail {formatPaise(r.retailPrice)}</span>
              </p>
              <label className="flex items-center gap-2 text-sm font-semibold">
                Sell wholesale
                <Switch checked={r.wholesaleEnabled} onChange={(v) => upd(i, { wholesaleEnabled: v })} label={`Sell ${SIZE_LABELS[r.size]} wholesale`} />
              </label>
            </div>
            {r.wholesaleEnabled && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Price / unit (₹, excl. GST)" htmlFor={`ws-price-${i}`} error={errors[`variants.${i}.wholesalePrice`]}>
                    <Input id={`ws-price-${i}`} type="number" min={0.01} step="0.01" value={r.price} onChange={(e) => upd(i, { price: e.target.value })} />
                  </Field>
                  <Field label="Units per pack" htmlFor={`ws-pack-${i}`} error={errors[`variants.${i}.packSize`]}>
                    <Input id={`ws-pack-${i}`} type="number" min={1} value={r.packSize} onChange={(e) => upd(i, { packSize: e.target.value })} />
                  </Field>
                  <Field label="MOQ (units)" htmlFor={`ws-moq-${i}`} error={errors[`variants.${i}.moq`]}>
                    <Input id={`ws-moq-${i}`} type="number" min={1} value={r.moq} onChange={(e) => upd(i, { moq: e.target.value })} />
                  </Field>
                  <Field label="Packaging" htmlFor={`ws-pkg-${i}`}>
                    <Input id={`ws-pkg-${i}`} value={r.packaging} maxLength={60} placeholder="Case of 24 bottles" onChange={(e) => upd(i, { packaging: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">Volume discounts</p>
                  {errors[`variants.${i}.tiers`] && <p className="mb-2 text-sm text-danger">{errors[`variants.${i}.tiers`]}</p>}
                  <ul className="space-y-2">
                    {r.tiers.map((t, k) => (
                      <li key={k} className="flex flex-wrap items-center gap-2 text-sm">
                        From
                        <label className="sr-only" htmlFor={`ws-tmin-${i}-${k}`}>
                          Minimum units
                        </label>
                        <Input id={`ws-tmin-${i}-${k}`} type="number" min={2} value={t.min} className="h-10 w-28 px-3" onChange={(e) => upd(i, { tiers: r.tiers.map((x, j) => (j === k ? { ...x, min: e.target.value } : x)) })} />
                        units,
                        <label className="sr-only" htmlFor={`ws-tpct-${i}-${k}`}>
                          Percent off
                        </label>
                        <Input id={`ws-tpct-${i}-${k}`} type="number" min={0.01} max={90} step="0.01" value={t.pct} className="h-10 w-24 px-3" onChange={(e) => upd(i, { tiers: r.tiers.map((x, j) => (j === k ? { ...x, pct: e.target.value } : x)) })} />
                        % off
                        <Button size="sm" variant="ghost" className="text-danger" aria-label="Remove tier" onClick={() => upd(i, { tiers: r.tiers.filter((_, j) => j !== k) })}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {r.tiers.length < 6 && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => upd(i, { tiers: [...r.tiers, { min: "", pct: "" }] })}>
                      <Plus className="size-4" aria-hidden /> Add tier
                    </Button>
                  )}
                </div>
              </>
            )}
          </fieldset>
        ))}
      </div>
    </Panel>
  );
}
