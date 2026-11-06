import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WholesaleBill } from "@/components/shop/business/wholesale-bill";
import { requireBusiness } from "@/server/business-auth";
import { getCreditSummary } from "@/server/credit";
import { isQuoteExpired } from "@/server/quotations";
import { db } from "@/lib/db";
import { addDays, istDateKey, startOfDayIST } from "@/lib/dates";
import { formatRate } from "@/lib/gst";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/order-format";
import { QUOTATION_STATUS_LABELS, SIZE_LABELS } from "@/lib/types";
import { QuoteResponse } from "./quote-response";
import { getShopName } from "@/server/brand";

export const metadata = { title: "Quotation" };

export default async function BusinessQuotationPage({ params }: PageProps<"/business/quotations/[number]">) {
  const business = await requireBusiness({ approved: true });
  const { number } = await params;
  const shopName = await getShopName();
  const q = await db.quotation.findFirst({
    where: { number: number.toUpperCase(), businessId: business.id },
    include: { items: { orderBy: { id: "asc" } }, order: { select: { orderNumber: true } } },
  });
  if (!q) notFound();
  const [address, credit, settings] = await Promise.all([
    q.addressId ? db.businessAddress.findUnique({ where: { id: q.addressId } }) : null,
    getCreditSummary(business.id),
    db.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { codEnabled: true, payAtShopEnabled: true } }),
  ]);
  const expired = isQuoteExpired(q);
  const tomorrow = addDays(startOfDayIST(), 1);

  return (
    <div className="space-y-6">
      <Link href="/business/quotations" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Quotations
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Quotation {q.number}</h1>
          <p className="text-ink-soft">
            Requested {formatDateTime(q.createdAt)}
            {q.quotedAt ? ` · quoted ${formatDateTime(q.quotedAt)}` : ""}
            {q.validUntil && q.status === "QUOTED" ? ` · valid until ${formatDate(q.validUntil)}` : ""}
          </p>
        </div>
        <Badge tone={expired ? "neutral" : q.status === "QUOTED" ? "success" : q.status === "REQUESTED" ? "warning" : "neutral"}>{expired ? "Expired" : QUOTATION_STATUS_LABELS[q.status]}</Badge>
      </div>

      {q.status === "REQUESTED" && <p className="rounded-2xl bg-mango-soft px-4 py-3 font-semibold text-warning">We&apos;re preparing your quote. Prices below are your current prices and may change.</p>}
      {q.order && (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 font-semibold text-brand-deep">
          Accepted – this quotation became order{" "}
          <Link href={`/business/orders/${q.order.orderNumber}`} className="underline">
            {q.order.orderNumber}
          </Link>
          .
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="overflow-x-auto rounded-card bg-surface p-5 shadow-warm-soft">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">GST</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 font-semibold">
                      {i.productName} <span className="font-normal text-ink-muted">({SIZE_LABELS[i.size]})</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{i.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatPaise(i.unitPrice)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatRate(i.gstRateBps)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{formatPaise(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {(q.requestNote || q.staffNote) && (
            <section className="space-y-3 rounded-card bg-surface p-5 text-sm shadow-warm-soft">
              {q.requestNote && (
                <p>
                  <span className="font-bold">Your note:</span> {q.requestNote}
                </p>
              )}
              {q.staffNote && (
                <p>
                  <span className="font-bold">From {shopName}:</span> {q.staffNote}
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <section className="rounded-card bg-surface p-5 shadow-warm-soft">
            <WholesaleBill totals={q} fulfilment={q.fulfilment} placeOfSupply={q.placeOfSupply} />
            <p className="mt-3 text-sm text-ink-soft">
              {q.fulfilment === "DELIVERY" ? `Deliver to: ${address ? `${address.label}, ${address.area}, ${address.city} ${address.pincode}` : "—"}` : "Pickup from the shop"}
            </p>
          </section>
          {(q.status === "QUOTED" || q.status === "REQUESTED") && !expired && (
            <QuoteResponse
              number={q.number}
              status={q.status}
              fulfilment={q.fulfilment}
              total={q.total}
              options={{
                credit: { isActive: credit.isActive, available: credit.available, limit: credit.limit, days: credit.days, overdue: credit.overdue },
                codEnabled: settings.codEnabled,
                payAtShopEnabled: settings.payAtShopEnabled,
                earliestDate: istDateKey(tomorrow),
                latestDate: istDateKey(addDays(tomorrow, 29)),
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
