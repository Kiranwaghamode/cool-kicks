import { formatPaise } from "@/lib/money";
import type { OrderTotals } from "@/lib/pricing";
import type { Fulfilment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Subtotal / discount / delivery / total rows. Values must come from the server. */
export function BillSummary({
  totals,
  fulfilment,
  couponCode,
  deliveryKnown = true,
  className,
}: {
  totals: Pick<OrderTotals, "subtotal" | "discount" | "deliveryFee" | "total">;
  fulfilment: Fulfilment;
  couponCode?: string | null;
  /** For delivery before a pincode is entered. */
  deliveryKnown?: boolean;
  className?: string;
}) {
  return (
    <dl className={cn("space-y-2.5 text-[15px]", className)}>
      <div className="flex justify-between">
        <dt className="text-ink-soft">Item total</dt>
        <dd className="font-semibold tabular-nums">{formatPaise(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between text-brand-deep">
          <dt>Discount{couponCode ? ` (${couponCode})` : ""}</dt>
          <dd className="font-semibold tabular-nums">−{formatPaise(totals.discount)}</dd>
        </div>
      )}
      {fulfilment === "DELIVERY" && (
        <div className="flex justify-between">
          <dt className="text-ink-soft">Delivery fee</dt>
          <dd className="font-semibold tabular-nums">
            {!deliveryKnown ? (
              <span className="text-sm font-medium text-ink-muted">Enter pincode</span>
            ) : totals.deliveryFee === 0 ? (
              <span className="text-brand-deep">FREE</span>
            ) : (
              formatPaise(totals.deliveryFee)
            )}
          </dd>
        </div>
      )}
      <div className="flex justify-between border-t border-dashed border-line-strong pt-3 text-lg">
        <dt className="font-bold">To pay</dt>
        <dd className="font-extrabold tabular-nums">{formatPaise(totals.total)}</dd>
      </div>
    </dl>
  );
}
