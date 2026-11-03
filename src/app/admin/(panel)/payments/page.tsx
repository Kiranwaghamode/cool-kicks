import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader, Panel, StatTile, TableWrap, td, th } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { RangePicker } from "../reports/range-picker";
import { requireRole } from "@/server/auth-guard";
import { resolveRange } from "@/server/admin/reports";
import { getOutstandingByBusiness } from "@/server/admin/wholesale-reports";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import { istDateKey } from "@/lib/dates";
import { PAYMENT_MODE_LABELS } from "@/lib/types";

export const metadata = { title: "Payments" };

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireRole("payments");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const range = resolveRange(str("range") ?? "month", str("from"), str("to"));
  const [payments, outstanding] = await Promise.all([
    db.payment.findMany({
      where: { receivedAt: { gte: range.from, lt: range.to } },
      orderBy: { receivedAt: "desc" },
      take: 500,
      include: { order: { select: { orderNumber: true } }, business: { select: { id: true, legalName: true, tradeName: true } } },
    }),
    getOutstandingByBusiness(),
  ]);
  const received = payments.filter((p) => p.kind === "PAYMENT").reduce((s, p) => s + p.amount, 0);
  const refunded = payments.filter((p) => p.kind === "REFUND").reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = outstanding.reduce((s, o) => s + o.outstanding, 0);
  const totalOverdue = outstanding.reduce((s, o) => s + o.overdue, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Wholesale payments recorded against orders – advance, partial and full. Record new payments from the order."
        actions={<RangePicker range={range.key} from={str("from") ?? istDateKey(range.from)} to={str("to") ?? istDateKey(range.to)} basePath="/admin/payments" />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Received" value={formatPaise(received)} hint={`${payments.filter((p) => p.kind === "PAYMENT").length} payments in range`} />
        <StatTile label="Refunded" value={formatPaise(refunded)} tone="melon" />
        <StatTile label="Outstanding" value={formatPaise(totalOutstanding)} hint="All businesses, open orders" tone="mango" />
        <StatTile label="Overdue" value={formatPaise(totalOverdue)} hint="Invoices past due" tone="melon" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Outstanding by business">
          {outstanding.length === 0 ? (
            <p className="text-ink-soft">No outstanding balances. 🎉</p>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Business</th>
                    <th className={th}>Outstanding</th>
                    <th className={th}>Overdue</th>
                    <th className={th}>Credit limit</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((o) => (
                    <tr key={o.businessId} className="border-b border-line last:border-0">
                      <td className={td}>
                        <Link href={`/admin/businesses/${o.businessId}`} className="font-semibold text-brand-deep hover:underline">
                          {o.name}
                        </Link>
                      </td>
                      <td className={`${td} font-bold tabular-nums`}>{formatPaise(o.outstanding)}</td>
                      <td className={`${td} tabular-nums ${o.overdue ? "font-bold text-danger" : "text-ink-muted"}`}>{formatPaise(o.overdue)}</td>
                      <td className={`${td} tabular-nums text-ink-soft`}>{o.creditActive ? formatPaise(o.creditLimit) : "Advance only"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <Panel title={`Payments (${payments.length})`}>
          {payments.length === 0 ? (
            <EmptyState icon={<Wallet />} title="No payments in this range" />
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={th}>Date</th>
                    <th className={th}>Order</th>
                    <th className={th}>Business</th>
                    <th className={th}>Mode</th>
                    <th className={th}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className={`${td} whitespace-nowrap`}>{formatDate(p.receivedAt)}</td>
                      <td className={td}>
                        <Link href={`/admin/orders?q=${p.order.orderNumber}&open=${p.order.orderNumber}`} className="font-semibold text-brand-deep hover:underline">
                          {p.order.orderNumber}
                        </Link>
                      </td>
                      <td className={td}>{p.business ? p.business.tradeName || p.business.legalName : "—"}</td>
                      <td className={td}>
                        {PAYMENT_MODE_LABELS[p.mode]}
                        {p.reference && <span className="block text-xs text-ink-muted">{p.reference}</span>}
                      </td>
                      <td className={`${td} font-bold tabular-nums ${p.kind === "REFUND" ? "text-danger" : ""}`}>
                        {p.kind === "REFUND" ? "−" : ""}
                        {formatPaise(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}
