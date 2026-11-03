import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader, Panel, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { invoiceSlug } from "@/lib/gst";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import type { Prisma } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Invoices" };

const TABS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default async function AdminInvoicesPage({ searchParams }: PageProps<"/admin/invoices">) {
  await requireRole("invoices");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.value === sp.tab)?.value ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";
  const now = new Date();

  const where: Prisma.InvoiceWhereInput = {
    ...(tab === "cancelled" ? { status: "CANCELLED" } : tab === "all" ? {} : { status: "ISSUED" }),
    ...(tab === "overdue" ? { dueDate: { lt: now } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q.toUpperCase().replace(/-/g, "/") } },
            { number: { contains: q.toUpperCase() } },
            { order: { orderNumber: { contains: q.toUpperCase() } } },
            { business: { legalName: { contains: q, mode: "insensitive" } } },
            { business: { tradeName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const rows = await db.invoice.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: 300,
    select: {
      number: true,
      status: true,
      issuedAt: true,
      dueDate: true,
      total: true,
      business: { select: { id: true, legalName: true, tradeName: true } },
      order: { select: { orderNumber: true, amountPaid: true } },
    },
  });
  const invoices = rows
    .map((i) => ({ ...i, balance: i.status === "ISSUED" ? Math.max(0, i.total - i.order.amountPaid) : 0 }))
    .filter((i) => (tab === "unpaid" || tab === "overdue" ? i.balance > 0 : true));

  return (
    <>
      <PageHeader title="Invoices" description="GST tax invoices for wholesale orders. Issued automatically on dispatch, numbered per financial year." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Filter invoices" className="flex gap-1 rounded-full bg-cream p-1">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/admin/invoices?tab=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={tab === t.value ? "page" : undefined}
              className={cn("h-10 rounded-full px-4 text-sm leading-10 font-semibold", tab === t.value ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface")}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form role="search" className="ml-auto">
          <input type="hidden" name="tab" value={tab} />
          <label htmlFor="inv-q" className="sr-only">
            Search invoices
          </label>
          <input id="inv-q" name="q" defaultValue={q} placeholder="Invoice, order or business" className="h-10 w-64 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
        </form>
      </div>
      <Panel>
        {invoices.length === 0 ? (
          <EmptyState icon={<FileText />} title="No invoices" />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Invoice</th>
                  <th className={th}>Business</th>
                  <th className={th}>Order</th>
                  <th className={th}>Total</th>
                  <th className={th}>Balance</th>
                  <th className={th}>Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const overdue = i.balance > 0 && i.dueDate < now;
                  return (
                    <tr key={i.number} className="border-b border-line last:border-0">
                      <td className={td}>
                        <a href={`/admin/print/invoice/${invoiceSlug(i.number)}`} target="_blank" rel="noopener" className="font-bold text-brand-deep hover:underline">
                          {i.number}
                        </a>
                        <span className="block text-xs text-ink-muted">{formatDate(i.issuedAt)}</span>
                      </td>
                      <td className={td}>
                        <Link href={`/admin/businesses/${i.business.id}`} className="font-semibold hover:underline">
                          {i.business.tradeName || i.business.legalName}
                        </Link>
                      </td>
                      <td className={td}>
                        <Link href={`/admin/orders?q=${i.order.orderNumber}&open=${i.order.orderNumber}`} className="hover:underline">
                          {i.order.orderNumber}
                        </Link>
                      </td>
                      <td className={`${td} font-bold tabular-nums`}>{formatPaise(i.total)}</td>
                      <td className={`${td} tabular-nums`}>
                        {i.status === "CANCELLED" ? <Badge tone="neutral">Cancelled</Badge> : i.balance ? formatPaise(i.balance) : <Badge tone="success">Paid</Badge>}
                      </td>
                      <td className={`${td} whitespace-nowrap ${overdue ? "font-bold text-danger" : "text-ink-soft"}`}>
                        {i.balance ? `${formatDate(i.dueDate)}${overdue ? " · overdue" : ""}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
