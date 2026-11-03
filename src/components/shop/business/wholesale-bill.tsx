import { formatPaise } from "@/lib/money";
import { stateName } from "@/lib/gst";
import type { Fulfilment } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WholesaleBillTotals = {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  total: number;
};

/** Wholesale bill: taxable value, GST split and total. Values must come from the server. */
export function WholesaleBill({
  totals,
  fulfilment,
  placeOfSupply,
  deliveryKnown = true,
  amountPaid,
  className,
}: {
  totals: WholesaleBillTotals;
  fulfilment: Fulfilment;
  placeOfSupply?: string | null;
  deliveryKnown?: boolean;
  amountPaid?: number;
  className?: string;
}) {
  const row = (label: string, value: React.ReactNode, cls?: string) => (
    <div className={cn("flex justify-between gap-3", cls)}>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
  return (
    <dl className={cn("space-y-2 text-[15px]", className)}>
      {row("Item value (excl. GST)", formatPaise(totals.subtotal))}
      {totals.discount > 0 && row("Discount", `−${formatPaise(totals.discount)}`, "text-brand-deep")}
      {fulfilment === "DELIVERY" &&
        row("Delivery", !deliveryKnown ? <span className="text-sm font-medium text-ink-muted">Choose address</span> : totals.deliveryFee === 0 ? <span className="text-brand-deep">FREE</span> : formatPaise(totals.deliveryFee))}
      {totals.igst > 0 ? (
        row("IGST", formatPaise(totals.igst))
      ) : (
        <>
          {row("CGST", formatPaise(totals.cgst))}
          {row("SGST", formatPaise(totals.sgst))}
        </>
      )}
      <div className="flex justify-between border-t border-dashed border-line-strong pt-3 text-lg">
        <dt className="font-bold">Total</dt>
        <dd className="font-extrabold tabular-nums">{formatPaise(totals.total)}</dd>
      </div>
      {amountPaid !== undefined && amountPaid > 0 && (
        <>
          {row("Paid", formatPaise(amountPaid), "text-brand-deep")}
          {row("Balance due", formatPaise(Math.max(0, totals.total - amountPaid)), "text-base font-bold")}
        </>
      )}
      {placeOfSupply && <p className="pt-1 text-xs text-ink-muted">Place of supply: {stateName(placeOfSupply)} ({placeOfSupply})</p>}
    </dl>
  );
}
