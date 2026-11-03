import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MapPin, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BusinessStatusBadge, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/server/auth-guard";
import { getCreditSummary } from "@/server/credit";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/order-format";
import { stateName } from "@/lib/gst";
import { BUSINESS_TYPE_LABELS, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/types";
import type { OrderStatus } from "@/lib/order-status";
import { BusinessActions, DocumentReview } from "./business-actions";
import { CreditPanel } from "./credit-panel";
import { CustomerPricesPanel } from "./customer-prices-panel";

export const metadata = { title: "Business" };

export default async function BusinessDetailPage({ params }: PageProps<"/admin/businesses/[id]">) {
  const staff = await requireRole("businesses");
  const { id } = await params;
  const b = await db.business.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, name: true } },
      addresses: {
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          size: true,
          status: true,
          note: true,
          createdAt: true,
        },
      },
      credit: true,
      prices: {
        include: {
          variant: {
            select: {
              id: true,
              size: true,
              wholesalePrice: true,
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!b) notFound();

  const [groups, orders, logs, credit, variants] = await Promise.all([
    db.customerGroup.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.order.findMany({
      where: { businessId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        orderNumber: true,
        status: true,
        total: true,
        amountPaid: true,
        createdAt: true,
        paymentMethod: true,
      },
    }),
    db.auditLog.findMany({
      where: { entityType: "Business", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { staff: { select: { name: true } } },
    }),
    getCreditSummary(id),
    db.productVariant.findMany({
      where: { wholesaleEnabled: true, product: { isActive: true } },
      orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
      select: { id: true, size: true, wholesalePrice: true, product: { select: { name: true } } },
    }),
  ]);

  const details: [string, string][] = [
    ["Registered name", b.legalName],
    ["Trade name", b.tradeName ?? "—"],
    ["Type", BUSINESS_TYPE_LABELS[b.type]],
    ["GSTIN", b.gstin ?? "Not registered"],
    ["PAN", b.pan ?? "—"],
    ["State", `${stateName(b.stateCode)} (${b.stateCode})`],
    ["Contact", b.contactName],
    ["Mobile (login)", b.phone],
    ["Email", b.email ?? "—"],
    ["Customer group", b.group?.name ?? "—"],
    ["Registered", formatDateTime(b.createdAt)],
    ["Last login", b.lastLoginAt ? formatDateTime(b.lastLoginAt) : "Never"],
  ];

  return (
    <>
      <Link
        href="/admin/businesses"
        className="text-ink-soft hover:text-ink mb-3 inline-flex items-center gap-1 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden /> Businesses
      </Link>
      <PageHeader
        title={b.tradeName || b.legalName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <BusinessStatusBadge status={b.status} /> {BUSINESS_TYPE_LABELS[b.type]}
            {b.statusNote && b.status !== "APPROVED" && (
              <span className="text-danger text-sm">· {b.statusNote}</span>
            )}
          </span>
        }
        actions={
          <>
            <a
              href={`/admin/print/statement/${b.id}`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline" })}
            >
              <Wallet className="size-4" aria-hidden /> Statement
            </a>
            <BusinessActions
              business={{
                id: b.id,
                status: b.status,
                legalName: b.legalName,
                tradeName: b.tradeName ?? "",
                type: b.type,
                contactName: b.contactName,
                phone: b.phone,
                email: b.email ?? "",
                gstin: b.gstin ?? "",
                pan: b.pan ?? "",
                stateCode: b.stateCode,
                groupId: b.groupId ?? "",
              }}
              groups={groups}
            />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Details">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
                    {k}
                  </dt>
                  <dd className="font-semibold break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title={`Documents (${b.documents.length})`}>
            {b.documents.length === 0 ? (
              <p className="text-ink-soft">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-line divide-y">
                {b.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <a
                      href={`/admin/documents/${d.id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-brand-deep flex min-w-0 items-center gap-2 font-semibold hover:underline"
                    >
                      <FileText className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {DOCUMENT_TYPE_LABELS[d.type]} · {d.fileName}
                      </span>
                    </a>
                    <span className="text-ink-muted flex items-center gap-2 text-xs">
                      {(d.size / 1024).toFixed(0)} KB · {formatDate(d.createdAt)}
                      <Badge
                        tone={
                          d.status === "VERIFIED"
                            ? "success"
                            : d.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {DOCUMENT_STATUS_LABELS[d.status]}
                      </Badge>
                      {d.status === "PENDING" && <DocumentReview id={d.id} />}
                    </span>
                    {d.note && <p className="text-ink-soft w-full text-sm">{d.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {b.status === "APPROVED" && (
            <CustomerPricesPanel
              businessId={b.id}
              canEdit={can(staff.role, "pricing")}
              prices={b.prices.map((p) => ({
                variantId: p.variantId,
                label: `${p.variant.product.name} · ${p.variant.size.toLowerCase()}`,
                basePrice: p.variant.wholesalePrice,
                price: p.price,
                validTo: p.validTo ? p.validTo.toISOString().slice(0, 10) : "",
              }))}
              variants={variants.map((v) => ({
                id: v.id,
                label: `${v.product.name} · ${v.size.toLowerCase()}`,
                basePrice: v.wholesalePrice,
              }))}
            />
          )}

          <Panel
            title="Recent orders"
            action={
              <Link
                href={`/admin/orders?q=${b.phone}`}
                className="text-brand-deep text-sm font-bold underline"
              >
                All orders
              </Link>
            }
          >
            {orders.length === 0 ? (
              <p className="text-ink-soft">No orders yet.</p>
            ) : (
              <ul className="divide-line divide-y text-sm">
                {orders.map((o) => (
                  <li
                    key={o.orderNumber}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <Link
                      href={`/admin/orders?q=${o.orderNumber}`}
                      className="text-brand-deep font-bold hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                    <span className="text-ink-muted">{formatDate(o.createdAt)}</span>
                    <StatusBadge status={o.status as OrderStatus} />
                    <span className="tabular-nums">
                      {formatPaise(o.total)}
                      {o.amountPaid < o.total && (
                        <span className="text-warning block text-right text-xs">
                          {formatPaise(o.total - o.amountPaid)} due
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <CreditPanel
            businessId={b.id}
            canEdit={can(staff.role, "credit")}
            summary={credit}
            note={b.credit?.note ?? ""}
          />

          <Panel title="Addresses">
            {b.addresses.length === 0 ? (
              <p className="text-ink-soft">No addresses.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {b.addresses.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <MapPin className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="font-bold">{a.label}</span>{" "}
                      {a.isDefault && <Badge tone="success">Default</Badge>}
                      <span className="text-ink-soft block">
                        {[a.line1, a.line2, a.landmark, a.area, a.city, a.state, a.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                      <span className="text-ink-muted block">
                        {a.contactName} · {a.phone}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Activity">
            {logs.length === 0 ? (
              <p className="text-ink-soft">No activity yet.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {logs.map((l) => (
                  <li key={l.id}>
                    <span className="font-semibold">{l.summary}</span>
                    <span className="text-ink-muted block text-xs">
                      {formatDateTime(l.createdAt)} ·{" "}
                      {l.actorType === "STAFF"
                        ? (l.staff?.name ?? "Staff")
                        : l.actorType === "BUSINESS"
                          ? "Business"
                          : "System"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
