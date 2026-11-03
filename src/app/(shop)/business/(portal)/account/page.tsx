import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, Package, ScrollText, ShieldAlert, Wallet } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireBusiness } from "@/server/business-auth";
import { getCreditSummary } from "@/server/credit";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import { statusLabel, type OrderStatus } from "@/lib/order-status";
import { DOCUMENT_TYPE_LABELS, QUOTATION_STATUS_LABELS } from "@/lib/types";

export const metadata = { title: "Dashboard" };

function Tile({ label, value, hint, icon, tone = "brand" }: { label: string; value: string; hint?: string; icon: React.ReactNode; tone?: "brand" | "mango" | "danger" }) {
  const tones = { brand: "bg-brand-soft text-brand-deep", mango: "bg-mango-soft text-warning", danger: "bg-danger-soft text-danger" };
  return (
    <div className="rounded-card bg-surface p-5 shadow-warm-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-soft">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-full [&_svg]:size-5 ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export default async function BusinessDashboardPage() {
  const business = await requireBusiness();

  if (business.status !== "APPROVED") {
    const docs = await db.businessDocument.findMany({ where: { businessId: business.id }, select: { type: true, status: true }, orderBy: { createdAt: "asc" } });
    const pending = business.status === "PENDING";
    return (
      <div className="mx-auto max-w-2xl rounded-card bg-surface p-6 shadow-warm-soft md:p-8">
        <span className={`flex size-14 items-center justify-center rounded-full ${pending ? "bg-mango-soft text-warning" : "bg-danger-soft text-danger"}`}>
          {pending ? <Clock className="size-7" aria-hidden /> : <ShieldAlert className="size-7" aria-hidden />}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">
          {pending ? "Your application is under review" : business.status === "SUSPENDED" ? "Your account is suspended" : "Your application was not approved"}
        </h1>
        <p className="mt-2 text-ink-soft">
          {pending
            ? "Thanks for registering! Our team checks every business before showing wholesale prices. This usually takes one working day."
            : "Wholesale ordering is not available on this account right now."}
        </p>
        {business.statusNote && !pending && <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 font-semibold text-danger">Reason: {business.statusNote}</p>}
        {pending && (
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-brand-deep" aria-hidden /> Business details received
            </li>
            <li className="flex items-center gap-2">
              {docs.length ? <CheckCircle2 className="size-5 text-brand-deep" aria-hidden /> : <AlertTriangle className="size-5 text-warning" aria-hidden />}
              {docs.length ? `Documents uploaded: ${docs.map((d) => DOCUMENT_TYPE_LABELS[d.type]).join(", ")}` : "No documents yet – uploading your GST certificate speeds up approval"}
            </li>
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/business/profile">{pending ? "Upload documents" : "View profile"}</LinkButton>
          <LinkButton href="/contact" variant="outline">
            Contact us
          </LinkButton>
        </div>
      </div>
    );
  }

  const [credit, orders, quotes, openOrders] = await Promise.all([
    getCreditSummary(business.id),
    db.order.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { orderNumber: true, status: true, total: true, createdAt: true, poNumber: true, _count: { select: { items: true } } },
    }),
    db.quotation.findMany({
      where: { businessId: business.id, status: { in: ["REQUESTED", "QUOTED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { number: true, status: true, total: true, validUntil: true, createdAt: true },
    }),
    db.order.count({ where: { businessId: business.id, status: { notIn: ["DELIVERED", "CANCELLED", "REJECTED"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Welcome, {business.contactName.split(" ")[0]}</h1>
          <p className="text-ink-soft">Your wholesale account at a glance.</p>
        </div>
        <LinkButton href="/business/catalogue">
          Order stock <ArrowRight className="size-4" aria-hidden />
        </LinkButton>
      </div>

      {credit.overdue > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          {formatPaise(credit.overdue)} is overdue on {credit.overdueCount} invoice{credit.overdueCount === 1 ? "" : "s"}. Please clear it to keep ordering on credit.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Outstanding" value={formatPaise(credit.outstanding)} hint="Unpaid on open orders" icon={<Wallet />} tone={credit.outstanding ? "mango" : "brand"} />
        <Tile
          label="Available credit"
          value={credit.isActive ? formatPaise(credit.available) : "—"}
          hint={credit.isActive ? `Limit ${formatPaise(credit.limit)} · ${credit.days} days` : "Credit not enabled"}
          icon={<CheckCircle2 />}
        />
        <Tile label="Open orders" value={String(openOrders)} hint="Not yet delivered" icon={<Package />} />
        <Tile label="Open quotations" value={String(quotes.length)} icon={<ScrollText />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card bg-surface p-5 shadow-warm-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Recent orders</h2>
            <Link href="/business/orders" className="text-sm font-bold text-brand-deep underline">
              All orders
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="py-6 text-center text-ink-soft">No orders yet. Browse the catalogue to place your first bulk order.</p>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.orderNumber}>
                  <Link href={`/business/orders/${o.orderNumber}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-deep">
                    <span>
                      <span className="font-bold">{o.orderNumber}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatDate(o.createdAt)} · {o._count.items} item{o._count.items === 1 ? "" : "s"}
                        {o.poNumber ? ` · PO ${o.poNumber}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">{formatPaise(o.total)}</span>
                      <Badge tone="neutral">{statusLabel(o.status as OrderStatus, "WHOLESALE")}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card bg-surface p-5 shadow-warm-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Quotations</h2>
            <Link href="/business/quotations" className="text-sm font-bold text-brand-deep underline">
              All quotations
            </Link>
          </div>
          {quotes.length === 0 ? (
            <p className="py-6 text-center text-ink-soft">No open quotations. Need special pricing? Request a quote from your cart.</p>
          ) : (
            <ul className="divide-y divide-line">
              {quotes.map((q) => (
                <li key={q.number}>
                  <Link href={`/business/quotations/${q.number}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-deep">
                    <span>
                      <span className="font-bold">{q.number}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatDate(q.createdAt)}
                        {q.validUntil ? ` · valid until ${formatDate(q.validUntil)}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">{q.status === "QUOTED" ? formatPaise(q.total) : "—"}</span>
                      <Badge tone={q.status === "QUOTED" ? "success" : "warning"}>{QUOTATION_STATUS_LABELS[q.status]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <LinkButton href="/business/invoices" variant="outline">
          <FileText className="size-4" aria-hidden /> Invoices
        </LinkButton>
        <LinkButton href="/business/statement" variant="outline">
          <Wallet className="size-4" aria-hidden /> Account statement
        </LinkButton>
      </div>
    </div>
  );
}
