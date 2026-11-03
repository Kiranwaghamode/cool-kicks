import Link from "next/link";
import { Building2 } from "lucide-react";
import { BusinessStatusBadge, PageHeader, Panel, TableWrap, td, th } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/order-format";
import { stateName } from "@/lib/gst";
import { BUSINESS_TYPE_LABELS, type BusinessStatus } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Businesses" };

const TABS: { value: BusinessStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Awaiting approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export default async function BusinessesPage({ searchParams }: PageProps<"/admin/businesses">) {
  await requireRole("businesses");
  const sp = await searchParams;
  const counts = await db.business.groupBy({ by: ["status"], _count: { _all: true } });
  const countOf = (s: BusinessStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const defaultTab = countOf("PENDING") > 0 ? "PENDING" : "APPROVED";
  const tab = (TABS.some((t) => t.value === sp.status) ? sp.status : defaultTab) as BusinessStatus | "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";

  const where: Prisma.BusinessWhereInput = {
    ...(tab !== "ALL" ? { status: tab } : {}),
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\D/g, "") || q } },
            { gstin: { contains: q.toUpperCase() } },
            { contactName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const businesses = await db.business.findMany({
    where,
    orderBy: { createdAt: tab === "PENDING" ? "asc" : "desc" },
    take: 200,
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      type: true,
      status: true,
      contactName: true,
      phone: true,
      gstin: true,
      stateCode: true,
      createdAt: true,
      group: { select: { name: true } },
      _count: { select: { documents: true, orders: true } },
    },
  });

  return (
    <>
      <PageHeader title="Businesses" description="Retailers and distributors. Wholesale prices are visible only to approved accounts." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-cream p-1">
          {TABS.map((t) => {
            const active = t.value === tab;
            const count = t.value === "ALL" ? counts.reduce((n, c) => n + c._count._all, 0) : countOf(t.value);
            return (
              <Link
                key={t.value}
                href={`/admin/businesses?status=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
                  active ? "bg-brand text-white shadow-glow" : "text-ink-soft hover:bg-surface",
                )}
              >
                {t.label}
                <span className={cn("min-w-6 rounded-full px-1.5 text-center text-xs leading-5", active ? "bg-black/20" : "bg-surface")}>{count}</span>
              </Link>
            );
          })}
        </nav>
        <form role="search" className="ml-auto">
          <input type="hidden" name="status" value={tab} />
          <label htmlFor="biz-q" className="sr-only">
            Search businesses
          </label>
          <input
            id="biz-q"
            name="q"
            defaultValue={q}
            placeholder="Name, phone or GSTIN"
            className="h-10 w-64 rounded-full border border-line-strong bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </form>
      </div>

      <Panel>
        {businesses.length === 0 ? (
          <EmptyState icon={<Building2 />} title={q ? "No matches" : "Nothing here"} description={q ? "Try a different search." : "New registrations will appear here."} />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Business</th>
                  <th className={th}>Contact</th>
                  <th className={th}>GSTIN</th>
                  <th className={th}>Group</th>
                  <th className={th}>Status</th>
                  <th className={th}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0 hover:bg-cream-50">
                    <td className={td}>
                      <Link href={`/admin/businesses/${b.id}`} className="font-bold text-brand-deep hover:underline">
                        {b.tradeName || b.legalName}
                      </Link>
                      <span className="block text-xs text-ink-muted">
                        {BUSINESS_TYPE_LABELS[b.type]} · {stateName(b.stateCode)} · {b._count.orders} orders
                      </span>
                    </td>
                    <td className={td}>
                      {b.contactName}
                      <span className="block text-xs text-ink-muted">{b.phone}</span>
                    </td>
                    <td className={`${td} font-mono text-xs`}>
                      {b.gstin ?? "—"}
                      {b._count.documents > 0 && <span className="block font-sans text-ink-muted">{b._count.documents} document(s)</span>}
                    </td>
                    <td className={td}>{b.group?.name ?? "—"}</td>
                    <td className={td}>
                      <BusinessStatusBadge status={b.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDate(b.createdAt)}</td>
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
