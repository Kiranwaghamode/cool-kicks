"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Ban, Save, Send, Trash2 } from "lucide-react";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { WholesaleBill } from "@/components/shop/business/wholesale-bill";
import { formatRate } from "@/lib/gst";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { SIZE_LABELS, type Fulfilment, type QuotationStatus, type Size } from "@/lib/types";
import { calculateWholesaleTotals } from "@/lib/wholesale-pricing";
import { cancelQuotation, updateQuotation } from "@/server/actions/admin/quotations";

type Item = { id: string; name: string; size: Size; quantity: number; unitPrice: number; gstRateBps: number; currentPrice: number | null; basePrice: number | null; moq: number };
type Quote = {
  id: string;
  status: QuotationStatus;
  fulfilment: Fulfilment;
  discount: number;
  deliveryFee: number;
  validUntil: string;
  staffNote: string;
  requestNote: string;
  placeOfSupply: string;
  interState: boolean;
  address: string | null;
  zone: { name: string; deliveryFee: number } | null;
  totals: { subtotal: number; discount: number; deliveryFee: number; cgst: number; sgst: number; igst: number; taxTotal: number; total: number };
};

export function QuotationEditor({ quote, items, editable, credit }: { quote: Quote; items: Item[]; editable: boolean; credit: { isActive: boolean; available: number; outstanding: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(items.map((i) => ({ ...i, price: String(paiseToRupees(i.unitPrice)), qty: String(i.quantity) })));
  const [discount, setDiscount] = useState(String(paiseToRupees(quote.discount)));
  const [delivery, setDelivery] = useState(String(paiseToRupees(quote.deliveryFee)));
  const [validUntil, setValidUntil] = useState(quote.validUntil);
  const [note, setNote] = useState(quote.staffNote);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const interState = quote.interState;
  const preview = useMemo(() => {
    try {
      return calculateWholesaleTotals({
        lines: rows.filter((r) => Number(r.qty) > 0).map((r) => ({ unitPrice: rupeesToPaise(Number(r.price) || 0), quantity: Math.round(Number(r.qty) || 0), gstRateBps: r.gstRateBps })),
        discount: rupeesToPaise(Number(discount) || 0),
        deliveryFee: quote.fulfilment === "DELIVERY" ? rupeesToPaise(Number(delivery) || 0) : 0,
        interState,
      });
    } catch {
      return null;
    }
  }, [rows, discount, delivery, quote.fulfilment, interState]);

  function save(send: boolean) {
    start(async () => {
      const res = await updateQuotation({
        id: quote.id,
        items: rows.map((r) => ({ id: r.id, unitPrice: rupeesToPaise(Number(r.price) || 0), quantity: Math.round(Number(r.qty) || 0) })),
        discount: rupeesToPaise(Number(discount) || 0),
        deliveryFee: quote.fulfilment === "DELIVERY" ? rupeesToPaise(Number(delivery) || 0) : 0,
        validUntil,
        staffNote: note,
        send,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error("Not saved", res.error);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Panel title="Items">
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Product</th>
                  <th className={th}>Qty</th>
                  <th className={th}>Price / unit (₹)</th>
                  <th className={th}>GST</th>
                  <th className={th}>Amount</th>
                  {editable && <th className={th}><span className="sr-only">Remove</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-line last:border-0 ${Number(r.qty) === 0 ? "opacity-40" : ""}`}>
                    <td className={td}>
                      <span className="font-semibold">
                        {r.name} <span className="font-normal text-ink-muted">({SIZE_LABELS[r.size]})</span>
                      </span>
                      <span className="block text-xs text-ink-muted">
                        Their price {r.currentPrice !== null ? formatPaise(r.currentPrice) : "—"} · base {r.basePrice !== null ? formatPaise(r.basePrice) : "—"} · MOQ {r.moq}
                      </span>
                    </td>
                    <td className={td}>
                      <label htmlFor={`qi-q-${r.id}`} className="sr-only">
                        Quantity
                      </label>
                      <Input id={`qi-q-${r.id}`} type="number" min={0} disabled={!editable} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="h-10 w-24 px-3" />
                    </td>
                    <td className={td}>
                      <label htmlFor={`qi-p-${r.id}`} className="sr-only">
                        Price per unit
                      </label>
                      <Input id={`qi-p-${r.id}`} type="number" min={0.01} step="0.01" disabled={!editable} value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="h-10 w-28 px-3" />
                    </td>
                    <td className={`${td} tabular-nums`}>{formatRate(r.gstRateBps)}</td>
                    <td className={`${td} font-semibold tabular-nums`}>{formatPaise(rupeesToPaise(Number(r.price) || 0) * Math.round(Number(r.qty) || 0))}</td>
                    {editable && (
                      <td className={`${td} text-right`}>
                        <Button size="sm" variant="ghost" className="text-danger" aria-label={`Remove ${r.name}`} onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, qty: "0" } : x)))}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>

        <Panel title="Terms">
          {quote.requestNote && <p className="mb-4 rounded-2xl bg-cream-50 p-3 text-sm"><span className="font-bold">Business note:</span> {quote.requestNote}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Order discount (₹)" htmlFor="qe-disc" hint="Spread across items before GST">
              <Input id="qe-disc" type="number" min={0} step="0.01" disabled={!editable} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            {quote.fulfilment === "DELIVERY" ? (
              <Field label="Delivery fee (₹)" htmlFor="qe-del" hint={quote.zone ? `${quote.zone.name}: ${formatPaise(quote.zone.deliveryFee)}` : "Address is outside delivery zones"}>
                <Input id="qe-del" type="number" min={0} step="0.01" disabled={!editable} value={delivery} onChange={(e) => setDelivery(e.target.value)} />
              </Field>
            ) : (
              <p className="self-end pb-3 text-sm text-ink-soft">Pickup from the shop</p>
            )}
            <Field label="Valid until" htmlFor="qe-valid" hint="Empty = default validity when sent">
              <Input id="qe-valid" type="date" disabled={!editable} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
            <Field label="Message to the business" htmlFor="qe-note" className="sm:col-span-3">
              <Textarea id="qe-note" disabled={!editable} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Prices include free delivery for orders above 50 cases…" />
            </Field>
          </div>
        </Panel>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Panel title="Quote total">
          {preview ? <WholesaleBill totals={preview} fulfilment={quote.fulfilment} /> : <p className="text-danger">Check the prices.</p>}
          <p className="mt-3 text-xs text-ink-muted">
            Place of supply {quote.placeOfSupply}
            {quote.address ? ` · ${quote.address}` : ""}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Credit: {credit.isActive ? `${formatPaise(credit.available)} available` : "not enabled"} · {formatPaise(credit.outstanding)} outstanding
          </p>
          {editable && (
            <div className="mt-4 space-y-2">
              <Button className="w-full" loading={pending} onClick={() => save(true)}>
                <Send className="size-4" aria-hidden /> {quote.status === "QUOTED" ? "Update & re-send quote" : "Send quote"}
              </Button>
              <Button variant="outline" className="w-full" loading={pending} onClick={() => save(false)}>
                <Save className="size-4" aria-hidden /> Save draft
              </Button>
              <Button variant="ghost" className="w-full text-danger" onClick={() => setCancelling(true)}>
                <Ban className="size-4" aria-hidden /> Cancel quotation
              </Button>
            </div>
          )}
        </Panel>
      </aside>

      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel quotation"
        footer={
          <Button
            variant="danger"
            className="w-full"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await cancelQuotation(quote.id, reason);
                if (res.ok) {
                  toast.success(res.message ?? "Cancelled");
                  setCancelling(false);
                  router.refresh();
                } else toast.error("Not cancelled", res.error);
              })
            }
          >
            Cancel quotation
          </Button>
        }
      >
        <Field label="Reason (shown to the business)" htmlFor="qe-reason">
          <Input id="qe-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
