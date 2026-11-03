import Link from "next/link";
import { Info } from "lucide-react";
import { Panel, StatTile, TableWrap, td, th } from "@/components/admin/ui";
import { RankedBars } from "@/components/admin/charts";
import { formatPaise } from "@/lib/money";
import { BUSINESS_TYPE_LABELS } from "@/lib/types";
import type { WholesaleReport } from "@/server/admin/wholesale-reports";

/** Wholesale (B2B) part of the reports page: business-wise sales, demand and estimated margin. */
export function WholesaleSection({ w }: { w: WholesaleReport }) {
  return (
    <section aria-labelledby="ws-report" className="mt-8">
      <h2 id="ws-report" className="mb-3 text-xl font-extrabold">
        Wholesale (B2B)
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Wholesale gross" value={formatPaise(w.gross)} hint={`${w.orderCount} orders · excl. GST`} />
        <StatTile label="Discounts" value={`−${formatPaise(w.discounts)}`} tone="mango" />
        <StatTile label="Refunds" value={`−${formatPaise(w.refunds)}`} tone="melon" />
        <StatTile label="Wholesale net" value={formatPaise(w.net)} tone="brand" />
        <StatTile label="GST collected" value={formatPaise(w.gst)} hint="Payable to the government – not revenue" tone="ice" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Sales by business">
          {w.businesses.length === 0 ? (
            <p className="text-sm text-ink-muted">No wholesale sales in this period.</p>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Business</th>
                    <th className={th}>Type</th>
                    <th className={`${th} text-right`}>Orders</th>
                    <th className={`${th} text-right`}>Net sales</th>
                    <th className={`${th} text-right`}>GST</th>
                  </tr>
                </thead>
                <tbody>
                  {w.businesses.map((b) => (
                    <tr key={b.businessId} className="border-b border-line last:border-0">
                      <td className={td}>
                        <Link href={`/admin/businesses/${b.businessId}`} className="font-semibold text-brand-deep hover:underline">
                          {b.name}
                        </Link>
                      </td>
                      <td className={`${td} text-ink-soft`}>{BUSINESS_TYPE_LABELS[b.type]}</td>
                      <td className={`${td} text-right tabular-nums`}>{b.orders}</td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{formatPaise(b.net)}</td>
                      <td className={`${td} text-right tabular-nums text-ink-soft`}>{formatPaise(b.gst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
        <Panel title="Retailers vs distributors">
          {w.byType.some((t) => t.value > 0) ? (
            <>
              <RankedBars data={w.byType.map((t) => ({ label: t.label, value: t.value }))} colorBy="category" />
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {w.byType.map((t) => (
                  <li key={t.label}>
                    {t.label}: {t.businesses} active · {t.orders} orders
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-muted">No wholesale sales in this period.</p>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Product demand (wholesale)">
          {w.productDemand.length === 0 ? (
            <p className="text-sm text-ink-muted">No wholesale sales in this period.</p>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Product</th>
                    <th className={`${th} text-right`}>Units</th>
                    <th className={`${th} text-right`}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {w.productDemand.slice(0, 20).map((p) => (
                    <tr key={p.name} className="border-b border-line last:border-0">
                      <td className={`${td} font-semibold`}>{p.name}</td>
                      <td className={`${td} text-right tabular-nums`}>{p.units.toLocaleString("en-IN")}</td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{formatPaise(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
        <Panel title="Estimated gross margin">
          <p className="mb-3 flex items-start gap-2 rounded-2xl bg-ice px-3 py-2 text-xs text-ice-deep">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Estimate only – wholesale item revenue minus the cost price of the batches used. Excludes expenses, wastage and overheads. This is not profit.
          </p>
          {w.margin.confirmedOrders === 0 ? (
            <p className="text-sm text-ink-muted">Needs confirmed orders from batches with a cost price.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Revenue (costed orders)</dt>
                <dd className="font-semibold tabular-nums">{formatPaise(w.margin.revenue)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Cost of goods (batches)</dt>
                <dd className="font-semibold tabular-nums">−{formatPaise(w.margin.cogs)}</dd>
              </div>
              <div className="flex justify-between border-t border-dashed border-line-strong pt-2 text-base">
                <dt className="font-bold">Estimated gross margin</dt>
                <dd className="font-extrabold tabular-nums">
                  {formatPaise(Math.max(0, w.margin.estimated))}
                  {w.margin.pct !== null && <span className="ml-1 text-sm font-semibold text-ink-soft">({w.margin.pct}%)</span>}
                </dd>
              </div>
              {w.margin.uncostedUnits > 0 && <p className="text-xs text-ink-muted">{w.margin.uncostedUnits} units came from batches without a cost price and are left out.</p>}
            </dl>
          )}
        </Panel>
      </div>
    </section>
  );
}
