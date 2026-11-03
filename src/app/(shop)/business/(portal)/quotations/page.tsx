import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireBusiness } from "@/server/business-auth";
import { isQuoteExpired } from "@/server/quotations";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import { QUOTATION_STATUS_LABELS } from "@/lib/types";

export const metadata = { title: "Quotations" };

export default async function BusinessQuotationsPage() {
  const business = await requireBusiness({ approved: true });
  const quotes = await db.quotation.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { number: true, status: true, total: true, validUntil: true, createdAt: true, _count: { select: { items: true } }, order: { select: { orderNumber: true } } },
  });
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Quotations</h1>
          <p className="text-ink-soft">Ask for special prices on large orders. Add items to your cart, then choose “Request a quotation”.</p>
        </div>
        <LinkButton href="/business/cart" variant="outline">
          Go to bulk cart
        </LinkButton>
      </div>
      {quotes.length === 0 ? (
        <EmptyState icon={<ScrollText />} title="No quotations yet" description="Your quotation requests and our quotes will appear here." />
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => {
            const expired = isQuoteExpired(q);
            return (
              <li key={q.number}>
                <Link href={`/business/quotations/${q.number}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card bg-surface p-4 shadow-warm-soft transition hover:shadow-warm md:p-5">
                  <div className="min-w-40 flex-1">
                    <p className="font-extrabold">{q.number}</p>
                    <p className="text-xs text-ink-muted">
                      Requested {formatDate(q.createdAt)} · {q._count.items} item{q._count.items === 1 ? "" : "s"}
                      {q.order ? ` · order ${q.order.orderNumber}` : ""}
                    </p>
                  </div>
                  <Badge tone={expired ? "neutral" : q.status === "QUOTED" ? "success" : q.status === "REQUESTED" ? "warning" : "neutral"}>
                    {expired ? "Expired" : QUOTATION_STATUS_LABELS[q.status]}
                  </Badge>
                  <div className="ml-auto text-right">
                    <p className="font-extrabold tabular-nums">{q.status === "REQUESTED" ? "Awaiting quote" : formatPaise(q.total)}</p>
                    {q.status === "QUOTED" && q.validUntil && <p className="text-xs text-ink-muted">Valid until {formatDate(q.validUntil)}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
