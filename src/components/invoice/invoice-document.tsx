import { amountInWords, formatRate } from "@/lib/gst";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import { PAYMENT_METHOD_LABELS, SIZE_LABELS, type PaymentMethod, type Size } from "@/lib/types";
import type { InvoiceSnapshot } from "@/server/invoices";

/** A4 GST tax invoice, rendered from the immutable snapshot taken when it was issued. */
export function InvoiceDocument({ inv, cancelled, amountPaid }: { inv: InvoiceSnapshot; cancelled?: { at: string; reason: string | null } | null; amountPaid?: number }) {
  const t = inv.totals;
  const balance = amountPaid !== undefined ? Math.max(0, t.total - amountPaid) : null;
  const cell = "border border-black/30 px-2 py-1.5 align-top";
  const num = `${cell} text-right tabular-nums`;

  // HSN-wise tax summary (required on GST invoices).
  const hsn = new Map<string, { taxable: number; rate: number; cgst: number; sgst: number; igst: number }>();
  for (const l of inv.lines) {
    const key = `${l.hsnCode ?? "—"}|${l.gstRateBps}`;
    const h = hsn.get(key) ?? { taxable: 0, rate: l.gstRateBps, cgst: 0, sgst: 0, igst: 0 };
    h.taxable += l.taxable;
    h.cgst += l.cgst;
    h.sgst += l.sgst;
    h.igst += l.igst;
    hsn.set(key, h);
  }

  return (
    <article className="relative mx-auto max-w-[210mm] bg-white p-6 text-[12px] leading-snug text-black print:p-0">
      {cancelled && (
        <p className="mb-3 rounded border-2 border-red-700 p-2 text-center text-base font-bold text-red-700">
          CANCELLED on {formatDate(cancelled.at)}
          {cancelled.reason ? ` – ${cancelled.reason}` : ""}
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <p className="text-xl font-extrabold">{inv.seller.name}</p>
          <p className="max-w-sm">{inv.seller.address}</p>
          <p>
            {inv.seller.phone}
            {inv.seller.email ? ` · ${inv.seller.email}` : ""}
          </p>
          <p className="font-semibold">GSTIN: {inv.seller.gstin ?? "Not registered"}</p>
          <p>
            State: {inv.seller.state} ({inv.seller.stateCode})
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold tracking-wide">TAX INVOICE</p>
          <p>
            Invoice no: <strong>{inv.number}</strong>
          </p>
          <p>Date: {formatDate(inv.issuedAt)}</p>
          <p>Due: {formatDate(inv.dueDate)}</p>
          <p>Order: {inv.orderNumber}</p>
          {inv.poNumber && (
            <p>
              PO: {inv.poNumber}
              {inv.poDate ? ` (${formatDate(inv.poDate)})` : ""}
            </p>
          )}
        </div>
      </header>

      <section className="grid gap-4 border-b border-black/30 py-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold tracking-wide uppercase">Bill to</p>
          <p className="font-bold">{inv.buyer.name}</p>
          {inv.buyer.tradeName && <p>{inv.buyer.tradeName}</p>}
          <p>{inv.buyer.address}</p>
          <p>Phone: {inv.buyer.phone}</p>
          <p className="font-semibold">GSTIN: {inv.buyer.gstin ?? "Unregistered"}</p>
          <p>
            State: {inv.buyer.state} ({inv.buyer.stateCode})
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-wide uppercase">Ship to</p>
          <p>{inv.shipTo ?? "Collected from shop"}</p>
          <p className="mt-2">
            Place of supply: <strong>{inv.placeOfSupply}</strong> · {inv.interState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}
          </p>
          <p>Payment: {PAYMENT_METHOD_LABELS[inv.paymentMethod as PaymentMethod] ?? inv.paymentMethod}</p>
        </div>
      </section>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-black/5 text-[11px] uppercase">
            <th className={cell}>#</th>
            <th className={`${cell} text-left`}>Item</th>
            <th className={cell}>HSN</th>
            <th className={cell}>Qty</th>
            <th className={cell}>Rate</th>
            <th className={cell}>Taxable</th>
            <th className={cell}>GST</th>
            {inv.interState ? <th className={cell}>IGST</th> : (
              <>
                <th className={cell}>CGST</th>
                <th className={cell}>SGST</th>
              </>
            )}
            <th className={cell}>Total</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td className={`${cell} text-center`}>{i + 1}</td>
              <td className={cell}>
                {l.name} ({SIZE_LABELS[l.size as Size] ?? l.size})
                {l.discount > 0 && <span className="block text-[10px]">Discount {formatPaise(l.discount)}</span>}
              </td>
              <td className={`${cell} text-center`}>{l.hsnCode ?? "—"}</td>
              <td className={num}>{l.quantity}</td>
              <td className={num}>{formatPaise(l.unitPrice)}</td>
              <td className={num}>{formatPaise(l.taxable)}</td>
              <td className={num}>{formatRate(l.gstRateBps)}</td>
              {inv.interState ? <td className={num}>{formatPaise(l.igst)}</td> : (
                <>
                  <td className={num}>{formatPaise(l.cgst)}</td>
                  <td className={num}>{formatPaise(l.sgst)}</td>
                </>
              )}
              <td className={num}>{formatPaise(l.taxable + l.cgst + l.sgst + l.igst)}</td>
            </tr>
          ))}
          {t.deliveryFee > 0 && (
            <tr>
              <td className={cell} />
              <td className={cell}>Delivery charges</td>
              <td className={`${cell} text-center`}>—</td>
              <td className={num}>1</td>
              <td className={num}>{formatPaise(t.deliveryFee)}</td>
              <td className={num}>{formatPaise(t.deliveryFee)}</td>
              <td className={num} />
              {inv.interState ? <td className={num}>{formatPaise(t.deliveryTax)}</td> : (
                <>
                  <td className={num}>{formatPaise(t.deliveryTax / 2)}</td>
                  <td className={num}>{formatPaise(t.deliveryTax / 2)}</td>
                </>
              )}
              <td className={num}>{formatPaise(t.deliveryFee + t.deliveryTax)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_260px]">
        <div>
          <p className="text-[11px] font-bold uppercase">HSN summary</p>
          <table className="mt-1 w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-black/5">
                <th className={cell}>HSN</th>
                <th className={cell}>Taxable</th>
                <th className={cell}>Rate</th>
                <th className={cell}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {[...hsn.entries()].map(([k, h]) => (
                <tr key={k}>
                  <td className={`${cell} text-center`}>{k.split("|")[0]}</td>
                  <td className={num}>{formatPaise(h.taxable)}</td>
                  <td className={num}>{formatRate(h.rate)}</td>
                  <td className={num}>{formatPaise(h.cgst + h.sgst + h.igst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3">
            <strong>Amount in words:</strong> {amountInWords(t.total)}
          </p>
        </div>
        <dl className="space-y-1">
          {[
            ["Item value", formatPaise(t.subtotal)],
            ...(t.discount ? [["Discount", `−${formatPaise(t.discount)}`]] : []),
            ...(t.deliveryFee ? [["Delivery", formatPaise(t.deliveryFee)]] : []),
            ["Taxable value", formatPaise(t.taxableValue)],
            ...(inv.interState ? [["IGST", formatPaise(t.igst)]] : [["CGST", formatPaise(t.cgst)], ["SGST", formatPaise(t.sgst)]]),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt>{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t-2 border-black pt-1 text-base font-extrabold">
            <dt>Invoice total</dt>
            <dd className="tabular-nums">{formatPaise(t.total)}</dd>
          </div>
          {balance !== null && amountPaid! > 0 && (
            <>
              <div className="flex justify-between">
                <dt>Paid</dt>
                <dd className="tabular-nums">{formatPaise(amountPaid!)}</dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatPaise(balance)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <footer className="mt-6 grid gap-4 border-t border-black/30 pt-3 sm:grid-cols-2">
        <div>
          {inv.seller.bankDetails && (
            <p>
              <strong>Bank details:</strong> {inv.seller.bankDetails}
            </p>
          )}
          {inv.seller.terms && <p className="mt-2 text-[11px]">{inv.seller.terms}</p>}
        </div>
        <div className="text-right">
          <p>For {inv.seller.name}</p>
          <p className="mt-10 border-t border-black/50 pt-1 text-[11px]">Authorised signatory</p>
        </div>
      </footer>
      <p className="mt-4 text-center text-[10px] text-black/60">This is a computer-generated invoice.</p>
    </article>
  );
}
