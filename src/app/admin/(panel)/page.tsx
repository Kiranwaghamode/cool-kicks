import Link from "next/link";
import { AlertTriangle, Ban, Building2, ClipboardList, IndianRupee, PackageX, Receipt, ScrollText, Timer, Wallet } from "lucide-react";
import { PageHeader, Panel, StatTile, StatusBadge, PaymentBadge, th, td, TableWrap } from "@/components/admin/ui";
import { DailySalesChart } from "@/components/admin/charts";
import { LinkButton } from "@/components/ui/button";
import { getDashboardData } from "@/server/admin/dashboard";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/order-format";
import { getStaff } from "@/server/auth-guard";
import { can } from "@/lib/permissions";
import { getShopName } from "@/server/brand";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [d, staff, shopName] = await Promise.all([getDashboardData(), getStaff(), getShopName()]);
  const canInventory = can(staff?.role, "inventory");

  return (
    <>
      <PageHeader title={`Hello, ${staff?.name.split(" ")[0] ?? "there"} 👋`} description={`Here's how ${shopName} is doing today. Figures are revenue, not profit.`} />

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

      {d.wholesale && (
        <Panel title="Wholesale (B2B)" className="mt-5" action={<LinkButton href="/admin/businesses" variant="outline" size="sm">Businesses</LinkButton>}>
          {(d.wholesale.pendingApproval > 0 || d.wholesale.quoteRequests > 0 || d.wholesale.expiringBatches > 0) && (
            <div className="mb-4 flex flex-wrap gap-2 text-sm font-semibold">
              {d.wholesale.pendingApproval > 0 && (
                <Link href="/admin/businesses?status=PENDING" className="rounded-full bg-mango-soft px-3 py-1.5 text-warning">
                  {d.wholesale.pendingApproval} business{d.wholesale.pendingApproval === 1 ? "" : "es"} awaiting approval →
                </Link>
              )}
              {d.wholesale.quoteRequests > 0 && (
                <Link href="/admin/quotations?tab=REQUESTED" className="rounded-full bg-melon-soft px-3 py-1.5 text-melon-deep">
                  {d.wholesale.quoteRequests} quotation request{d.wholesale.quoteRequests === 1 ? "" : "s"} →
                </Link>
              )}
              {d.wholesale.expiringBatches > 0 && (
                <Link href="/admin/finished-stock" className="rounded-full bg-danger-soft px-3 py-1.5 text-danger">
                  <PackageX className="mr-1 inline size-4" aria-hidden />
                  {d.wholesale.expiringBatches} batch{d.wholesale.expiringBatches === 1 ? "" : "es"} expiring in 3 days →
                </Link>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile label="Business customers" value={d.wholesale.approved} hint={`${d.wholesale.pendingApproval} pending approval`} icon={<Building2 />} />
            <StatTile label="Wholesale sales (30 days)" value={formatPaise(d.wholesale.sales30)} hint={`${d.wholesale.orders30} orders · excl. GST`} icon={<IndianRupee />} tone="ice" />
            <StatTile label="Pending quotations" value={d.wholesale.openQuotes + d.wholesale.quoteRequests} hint={`${d.wholesale.quoteRequests} new · ${d.wholesale.openQuotes} sent`} icon={<ScrollText />} tone="mango" />
            <StatTile label="Credit balances" value={formatPaise(d.wholesale.outstanding)} hint={`${d.wholesale.creditAccounts} credit accounts · limits ${formatPaise(d.wholesale.creditLimits)}`} icon={<Wallet />} tone="mango" />
            <StatTile label="Overdue payments" value={formatPaise(d.wholesale.overdue)} hint="Invoices past due" icon={<AlertTriangle />} tone="melon" />
          </div>
          {d.wholesale.overdueBusinesses.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {d.wholesale.overdueBusinesses.map((o) => (
                <li key={o.businessId} className="flex justify-between gap-3 py-2">
                  <Link href={`/admin/businesses/${o.businessId}`} className="font-semibold text-brand-deep hover:underline">
                    {o.name}
                  </Link>
                  <span className="tabular-nums">
                    <span className="font-bold text-danger">{formatPaise(o.overdue)} overdue</span> · {formatPaise(o.outstanding)} outstanding
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

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
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Stock &amp; expiry
            </span>
          }
          action={canInventory ? <LinkButton href="/admin/inventory" variant="outline" size="sm">Inventory</LinkButton> : undefined}
        >
          {d.expiryAlerts.length > 0 && (
            <ul className="mb-2 space-y-2 text-sm" aria-label="Expiry alerts">
              {d.expiryAlerts.map((i) => (
                <li key={`exp-${i.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-danger-soft/50 px-3 py-2">
                  <span className="font-semibold">{i.name}</span>
                  <span className={i.expired > 0 ? "font-bold text-danger" : "font-semibold text-warning"}>
                    {i.expired > 0
                      ? `${i.expired} ${i.unit.toLowerCase()} expired`
                      : `${i.expiringSoon} ${i.unit.toLowerCase()} expires ${i.nextExpiry ? formatDate(i.nextExpiry) : "soon"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
          ) : d.expiryAlerts.length ? null : (
            <p className="text-sm text-ink-muted">All ingredients are well stocked and in date.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
