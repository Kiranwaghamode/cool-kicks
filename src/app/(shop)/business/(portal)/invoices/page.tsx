import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireBusiness } from "@/server/business-auth";
import { db } from "@/lib/db";
import { invoiceSlug } from "@/lib/gst";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";

export const metadata = { title: "Invoices" };

export default async function BusinessInvoicesPage() {
  const business = await requireBusiness({ approved: true });
  const invoices = await db.invoice.findMany({
    where: { businessId: business.id },
    orderBy: { issuedAt: "desc" },
    take: 200,
    select: { number: true, status: true, issuedAt: true, dueDate: true, total: true, order: { select: { orderNumber: true, poNumber: true, amountPaid: true } } },
  });
  const now = new Date();
  return (
    <div>
      <h1 className="text-2xl font-extrabold md:text-3xl">Invoices</h1>
      <p className="mb-5 text-ink-soft">GST tax invoices for your orders. Open one to print or save it as PDF.</p>
      {invoices.length === 0 ? (
        <EmptyState icon={<FileText />} title="No invoices yet" description="Invoices are issued when your order is dispatched." />
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface p-4 shadow-warm-soft">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
                <th className="px-2 py-2.5">Invoice</th>
                <th className="px-2 py-2.5">Date</th>
                <th className="px-2 py-2.5">Order / PO</th>
                <th className="px-2 py-2.5 text-right">Amount</th>
                <th className="px-2 py-2.5 text-right">Balance</th>
                <th className="px-2 py-2.5">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const balance = i.status === "ISSUED" ? Math.max(0, i.total - i.order.amountPaid) : 0;
                const overdue = balance > 0 && i.dueDate < now;
                return (
                  <tr key={i.number} className="border-b border-line last:border-0">
                    <td className="px-2 py-3">
                      <Link href={`/business/invoices/${invoiceSlug(i.number)}`} className="font-bold text-brand-deep hover:underline">
                        {i.number}
                      </Link>
                      {i.status === "CANCELLED" && (
                        <Badge tone="neutral" className="ml-2">
                          Cancelled
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">{formatDate(i.issuedAt)}</td>
                    <td className="px-2 py-3">
                      <Link href={`/business/orders/${i.order.orderNumber}`} className="hover:underline">
                        {i.order.orderNumber}
                      </Link>
                      {i.order.poNumber && <span className="block text-xs text-ink-muted">PO {i.order.poNumber}</span>}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatPaise(i.total)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{balance ? formatPaise(balance) : <span className="text-brand-deep">Paid</span>}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{balance ? <span className={overdue ? "font-bold text-danger" : ""}>{formatDate(i.dueDate)}{overdue ? " · overdue" : ""}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
