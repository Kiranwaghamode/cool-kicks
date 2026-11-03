import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader, Panel, QuotationBadge, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/server/auth-guard";
import { isQuoteExpired } from "@/server/quotations";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/order-format";
import type { QuotationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Quotations" };

const TABS: { value: "OPEN" | QuotationStatus | "ALL"; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "REQUESTED", label: "New requests" },
  { value: "QUOTED", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "ALL", label: "All" },
];

export default async function AdminQuotationsPage({ searchParams }: PageProps<"/admin/quotations">) {
  await requireRole("quotations");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.value === sp.tab)?.value ?? "OPEN";
  const status = tab === "OPEN" ? { in: ["REQUESTED", "QUOTED"] as QuotationStatus[] } : tab === "ALL" ? undefined : tab;
  const quotes = await db.quotation.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: tab === "REQUESTED" ? "asc" : "desc" },
    take: 200,
    include: { business: { select: { legalName: true, tradeName: true } }, order: { select: { orderNumber: true } }, _count: { select: { items: true } } },
  });

  return (
    <>
      <PageHeader title="Quotations" description="Prepare prices for quotation requests. Businesses accept a sent quote to turn it into an order." />
      <nav aria-label="Filter quotations" className="mb-4 flex w-fit gap-1 rounded-full bg-cream p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/quotations?tab=${t.value}`}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn("h-10 rounded-full px-4 text-sm leading-10 font-semibold whitespace-nowrap", tab === t.value ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {quotes.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No quotations" description="Requests from businesses will appear here." />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Quote</th>
                  <th className={th}>Business</th>
                  <th className={th}>Items</th>
                  <th className={th}>Total</th>
                  <th className={th}>Status</th>
                  <th className={th}>Requested</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-line last:border-0 hover:bg-cream-50">
                    <td className={td}>
                      <Link href={`/admin/quotations/${q.id}`} className="font-bold text-brand-deep hover:underline">
                        {q.number}
                      </Link>
                      {q.order && <span className="block text-xs text-ink-muted">→ {q.order.orderNumber}</span>}
                    </td>
                    <td className={`${td} font-semibold`}>{q.business.tradeName || q.business.legalName}</td>
                    <td className={`${td} tabular-nums`}>{q._count.items}</td>
                    <td className={`${td} font-bold tabular-nums`}>{formatPaise(q.total)}</td>
                    <td className={td}>
                      <QuotationBadge status={q.status} />
                      {isQuoteExpired(q) && (
                        <Badge tone="neutral" className="ml-1">
                          Expired
                        </Badge>
                      )}
                      {q.status === "QUOTED" && q.validUntil && !isQuoteExpired(q) && <span className="block text-xs text-ink-muted">until {formatDate(q.validUntil)}</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDateTime(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
