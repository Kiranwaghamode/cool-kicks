import { Download, Info } from "lucide-react";
import { PageHeader, Panel, StatTile, TableWrap, td, th } from "@/components/admin/ui";
import { DailySalesChart, RankedBars } from "@/components/admin/charts";
import { buttonVariants } from "@/components/ui/button";
import { RangePicker } from "./range-picker";
import { ExpensesPanel } from "./expenses-panel";
import { requireRole } from "@/server/auth-guard";
import { getSalesReport, resolveRange } from "@/server/admin/reports";
import { addDays, istDateKey } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireRole("reports");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const { key, from, to } = resolveRange(s("range"), s("from"), s("to"));
  const r = await getSalesReport(from, to);
  const fromKey = istDateKey(from);
  const toKey = istDateKey(addDays(to, -1));
  const exportQs = new URLSearchParams({ from: fromKey, to: toKey }).toString();

  return (
    <>
      <PageHeader
        title="Sales reports"
        description={`${fromKey === toKey ? fromKey : `${fromKey} → ${toKey}`} · Asia/Kolkata time`}
        actions={
          <>
            <a href={`/admin/reports/export?format=csv&${exportQs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download className="size-4" aria-hidden /> CSV
            </a>
            <a href={`/admin/reports/export?format=xlsx&${exportQs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download className="size-4" aria-hidden /> Excel
            </a>
          </>
        }
      />
      <RangePicker range={key} from={fromKey} to={toKey} />

      <p className="mb-4 flex items-start gap-2 rounded-2xl bg-ice px-4 py-3 text-sm text-ice-deep">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        These figures are <strong>&nbsp;revenue, not profit</strong>. Cancelled and rejected orders are excluded. Gross = item totals + delivery fees.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Gross sales" value={formatPaise(r.gross)} hint="Before discounts" />
        <StatTile label="Discounts" value={`−${formatPaise(r.discounts)}`} tone="mango" />
        <StatTile label="Refunds" value={`−${formatPaise(r.refunds)}`} hint={`${r.refundCount} order${r.refundCount === 1 ? "" : "s"}`} tone="melon" />
        <StatTile label="Net sales" value={formatPaise(r.net)} hint="Gross − discounts − refunds" tone="brand" />
        <StatTile label="Total orders" value={r.orderCount} tone="ice" />
        <StatTile label="Cancelled / rejected" value={r.cancelledCount} tone="melon" />
        <StatTile label="Average order value" value={formatPaise(r.avgOrderValue)} tone="mango" />
        <StatTile label="Pickup · Delivery" value={`${r.fulfilmentCounts.pickup} · ${r.fulfilmentCounts.delivery}`} tone="ice" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Daily sales (after discounts)">
          {r.daily.length > 62 ? (
            <p className="text-sm text-ink-muted">Pick a shorter range to see the daily chart.</p>
          ) : (
            <DailySalesChart data={r.daily} height={280} />
          )}
        </Panel>
        <Panel title="Sales by category">{r.byCategory.length ? <RankedBars data={r.byCategory.slice(0, 8)} /> : <p className="text-sm text-ink-muted">No sales in this period.</p>}</Panel>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="By payment method">{r.byPayment.length ? <RankedBars data={r.byPayment} colorBy="category" /> : <p className="text-sm text-ink-muted">No sales.</p>}</Panel>
        <Panel title="Pickup vs delivery">{r.byFulfilment.length ? <RankedBars data={r.byFulfilment} colorBy="category" /> : <p className="text-sm text-ink-muted">No sales.</p>}</Panel>
      </div>

      <Panel title="Best-selling products" className="mt-5">
        {r.bestSellers.length ? (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>#</th>
                  <th className={th}>Product</th>
                  <th className={`${th} text-right`}>Quantity</th>
                  <th className={`${th} text-right`}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.bestSellers.map((b, i) => (
                  <tr key={b.name} className="border-b border-line last:border-0">
                    <td className={`${td} text-ink-muted`}>{i + 1}</td>
                    <td className={`${td} font-semibold`}>{b.name}</td>
                    <td className={`${td} text-right tabular-nums`}>{b.quantity}</td>
                    <td className={`${td} text-right font-bold tabular-nums`}>{formatPaise(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="text-sm text-ink-muted">No sales in this period.</p>
        )}
      </Panel>

      <ExpensesPanel
        expenses={r.expenses}
        total={r.expenseTotal}
        net={r.net}
        balance={r.estimatedBalance}
        defaultDate={istDateKey(new Date())}
      />
    </>
  );
}
