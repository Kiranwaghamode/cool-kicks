import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader, Panel, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/order-format";
import type { Prisma } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const PAGE = 50;
const AREAS = [
  { value: "", label: "Everything" },
  { value: "business", label: "Businesses" },
  { value: "credit", label: "Credit" },
  { value: "price", label: "Prices" },
  { value: "quotation", label: "Quotations" },
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "invoice", label: "Invoices" },
  { value: "batch", label: "Stock" },
  { value: "delivery", label: "Deliveries" },
];

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  await requireRole("auditLog");
  const sp = await searchParams;
  const area = AREAS.find((a) => a.value === sp.area)?.value ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = area
    ? area === "price"
      ? { OR: [{ action: { startsWith: "price" } }, { action: { startsWith: "pricelist" } }, { action: { startsWith: "product.wholesale" } }, { action: { startsWith: "group" } }] }
      : { action: { startsWith: area } }
    : {};
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { staff: { select: { name: true } }, business: { select: { id: true, legalName: true, tradeName: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader title="Audit log" description="Important actions by staff and business customers: approvals, credit, prices, payments, invoices and stock." />
      <nav aria-label="Filter" className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-full bg-cream p-1">
        {AREAS.map((a) => (
          <Link
            key={a.value}
            href={`/admin/audit-log${a.value ? `?area=${a.value}` : ""}`}
            aria-current={area === a.value ? "page" : undefined}
            className={cn("h-10 shrink-0 rounded-full px-4 text-sm leading-10 font-semibold whitespace-nowrap", area === a.value ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface")}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {logs.length === 0 ? (
          <EmptyState icon={<History />} title="Nothing logged yet" />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>When</th>
                  <th className={th}>Who</th>
                  <th className={th}>What</th>
                  <th className={th}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDateTime(l.createdAt)}</td>
                    <td className={td}>
                      {l.actorType === "STAFF" ? (
                        <span className="font-semibold">{l.staff?.name ?? "Staff (removed)"}</span>
                      ) : l.actorType === "BUSINESS" && l.business ? (
                        <Link href={`/admin/businesses/${l.business.id}`} className="font-semibold text-brand-deep hover:underline">
                          {l.business.tradeName || l.business.legalName}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">System</span>
                      )}
                      <Badge tone="neutral" className="ml-2">
                        {l.actorType === "STAFF" ? "Staff" : l.actorType === "BUSINESS" ? "Business" : "System"}
                      </Badge>
                    </td>
                    <td className={td}>
                      <span className="font-semibold">{l.summary}</span>
                      <span className="block font-mono text-xs text-ink-muted">{l.action}</span>
                    </td>
                    <td className={`${td} font-mono text-xs text-ink-muted`}>{l.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={`/admin/audit-log?area=${area}&page=${page - 1}`} className="font-semibold text-brand-deep underline">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-soft">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={`/admin/audit-log?area=${area}&page=${page + 1}`} className="font-semibold text-brand-deep underline">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Panel>
    </>
  );
}
