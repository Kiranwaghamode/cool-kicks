"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { removeCustomerPrice, saveCustomerPrice } from "@/server/actions/admin/businesses";

type Price = { variantId: string; label: string; basePrice: number | null; price: number; validTo: string };
type Variant = { id: string; label: string; basePrice: number | null };

export function CustomerPricesPanel({ businessId, prices, variants, canEdit }: { businessId: string; prices: Price[]; variants: Variant[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ variantId: string; price: string; validTo: string } | null>(null);

  const run = (p: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await p();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setDraft(null);
        router.refresh();
      } else toast.error("Not saved", res.error);
    });

  const selected = variants.find((v) => v.id === draft?.variantId);

  return (
    <Panel
      title="Special prices"
      action={
        canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setDraft({ variantId: variants[0]?.id ?? "", price: "", validTo: "" })} disabled={!variants.length}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        )
      }
    >
      <p className="mb-3 text-sm text-ink-soft">Negotiated prices for this business only (excl. GST). They replace price lists and volume discounts.</p>
      {prices.length === 0 ? (
        <p className="text-ink-muted">No special prices – the customer group&apos;s price list applies.</p>
      ) : (
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Product</th>
                <th className={th}>Base</th>
                <th className={th}>Special</th>
                <th className={th}>Until</th>
                {canEdit && <th className={th}><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.variantId} className="border-b border-line last:border-0">
                  <td className={`${td} font-semibold`}>{p.label}</td>
                  <td className={`${td} text-ink-muted tabular-nums`}>{p.basePrice !== null ? formatPaise(p.basePrice) : "—"}</td>
                  <td className={`${td} font-bold tabular-nums`}>{formatPaise(p.price)}</td>
                  <td className={`${td} text-ink-soft`}>{p.validTo || "No end"}</td>
                  {canEdit && (
                    <td className={`${td} text-right`}>
                      <Button size="sm" variant="ghost" className="text-danger" aria-label={`Remove special price for ${p.label}`} disabled={pending} onClick={() => run(() => removeCustomerPrice(businessId, p.variantId))}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title="Special price">
        {draft && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveCustomerPrice({ businessId, variantId: draft.variantId, price: rupeesToPaise(Number(draft.price) || 0), validTo: draft.validTo }));
            }}
          >
            <Field label="Product" htmlFor="cp-variant">
              <Select id="cp-variant" value={draft.variantId} onChange={(e) => setDraft({ ...draft, variantId: e.target.value })}>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price per unit, excl. GST (₹)" htmlFor="cp-price" hint={selected?.basePrice ? `Base wholesale price ${formatPaise(selected.basePrice)}` : undefined}>
              <Input id="cp-price" type="number" min={0.01} step="0.01" required value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </Field>
            <Field label="Valid until" htmlFor="cp-until" hint="Optional">
              <Input id="cp-until" type="date" value={draft.validTo} onChange={(e) => setDraft({ ...draft, validTo: e.target.value })} />
            </Field>
            <Button type="submit" loading={pending}>
              Save price
            </Button>
          </form>
        )}
      </Modal>
    </Panel>
  );
}
