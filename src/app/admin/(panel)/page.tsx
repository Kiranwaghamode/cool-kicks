import Link from "next/link";
import { AlertTriangle, Ban, ClipboardList, IndianRupee, Receipt, Timer } from "lucide-react";
import { PageHeader, Panel, StatTile, StatusBadge, PaymentBadge, th, td, TableWrap } from "@/components/admin/ui";
import { DailySalesChart } from "@/components/admin/charts";
import { LinkButton } from "@/components/ui/button";
import { getDashboardData } from "@/server/admin/dashboard";
import { formatPaise } from "@/lib/money";
import { formatDateTime } from "@/lib/order-format";
import { getStaff } from "@/server/auth-guard";
import { can } from "@/lib/permissions";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [d, staff] = await Promise.all([getDashboardData(), getStaff()]);
  const canInventory = can(staff?.role, "inventory");

  return (
    <>
      <PageHeader title={`Hello, ${staff?.name.split(" ")[0] ?? "there"} 👋`} description="Here's how Cool Kick is doing today. Figures are revenue, not profit." />

      {d.pending > 0 && (
        <Link
          href="/admin/orders?status=PLACED"
          className="mb-5 flex items-center gap-3 rounded-[20px] bg-melon-deep px-5 py-4 font-bold text-white shadow-[0_10px_25px_rgb(255_77_109/0.3)]"
        >
          <ClipboardList className="size-5" aria-hidden />
          {d.pending} new order{d.pending === 1 ? "" : "s"} waiting to be accepted
          <span className="ml-auto rounded-full bg-black/20 px-3 py-1 text-sm">Open orders →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Today's sales" value={formatPaise(d.salesToday)} hint="Excludes cancelled orders" icon={<IndianRupee />} />
        <StatTile label="Today's orders" value={d.ordersToday} icon={<Receipt />} tone="ice" />
        <StatTile label="Pending" value={d.pending} hint="Awaiting acceptance" icon={<Timer />} tone="melon" />
        <StatTile label="Avg order value" value={formatPaise(d.avgOrderValue)} icon={<IndianRupee />} tone="mango" />
        <StatTile label="Cancelled today" value={d.cancelledToday} icon={<Ban />} tone="melon" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Sales – last 7 days" action={<span className="text-sm font-semibold text-ink-soft">{formatPaise(d.weekTotal)} total</span>}>
          <DailySalesChart data={d.salesSeries} />
        </Panel>
        <Panel title="Best sellers (30 days)">
          {d.bestSellers.length ? (
            <ol className="space-y-3">
              {d.bestSellers.map((b, i) => (
                <li key={b.name} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 items-center justify-center rounded-full bg-cream font-bold">{i + 1}</span>
                  <span className="flex-1 font-semibold">{b.name}</span>
                  <span className="text-ink-soft">{b.quantity} sold</span>
                  <span className="w-20 text-right font-bold tabular-nums">{formatPaise(b.revenue)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-muted">No sales yet.</p>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Latest orders" action={<LinkButton href="/admin/orders" variant="outline" size="sm">All orders</LinkButton>}>
          {d.latest.length ? (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Order</th>
                    <th className={th}>Customer</th>
                    <th className={th}>Status</th>
                    <th className={th}>Payment</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.latest.map((o) => (
                    <tr key={o.id} className="border-b border-line last:border-0">
                      <td className={td}>
                        <Link href={`/admin/orders?open=${o.orderNumber}`} className="font-mono font-bold text-brand-deep hover:underline">
                          {o.orderNumber}
                        </Link>
                        <span className="block text-xs text-ink-muted">{formatDateTime(o.createdAt)}</span>
                      </td>
                      <td className={td}>
                        {o.customerName}
                        <span className="block text-xs text-ink-muted">{o.fulfilment === "PICKUP" ? "Pickup" : "Delivery"}</span>
                      </td>
                      <td className={td}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={td}>
                        <PaymentBadge status={o.paymentStatus} />
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums`}>{formatPaise(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <p className="text-sm text-ink-muted">No orders yet.</p>
          )}
        </Panel>
        <Panel
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Low stock
            </span>
          }
          action={canInventory ? <LinkButton href="/admin/inventory" variant="outline" size="sm">Inventory</LinkButton> : undefined}
        >
          {d.lowStock.length ? (
            <ul className="space-y-2 text-sm">
              {d.lowStock.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-3 py-2">
                  <span className="font-semibold">{i.name}</span>
                  <span className={i.stock <= 0 ? "font-bold text-danger" : "font-semibold text-warning"}>
                    {i.stock <= 0 ? "Out of stock" : `${i.stock} ${i.unit.toLowerCase()} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">All ingredients are well stocked.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
