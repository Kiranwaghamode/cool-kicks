import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, QuotationBadge } from "@/components/admin/ui";
import { requireRole } from "@/server/auth-guard";
import { getPricingContext, priceFor } from "@/server/wholesale";
import { getCreditSummary } from "@/server/credit";
import { db } from "@/lib/db";
import { istDateKey } from "@/lib/dates";
import { stateName } from "@/lib/gst";
import { formatDateTime } from "@/lib/order-format";
import { QuotationEditor } from "./quotation-editor";

export const metadata = { title: "Quotation" };

export default async function AdminQuotationPage({ params }: PageProps<"/admin/quotations/[id]">) {
  await requireRole("quotations");
  const { id } = await params;
  const q = await db.quotation.findUnique({
    where: { id },
    include: {
      business: { select: { id: true, legalName: true, tradeName: true, groupId: true, stateCode: true, gstin: true } },
      items: { orderBy: { id: "asc" }, include: { variant: { select: { id: true, wholesalePrice: true, moq: true, packSize: true, tiers: true } } } },
      order: { select: { orderNumber: true } },
    },
  });
  if (!q) notFound();
  const [address, ctx, credit, zone, settings] = await Promise.all([
    q.addressId ? db.businessAddress.findUnique({ where: { id: q.addressId } }) : null,
    getPricingContext({ id: q.business.id, groupId: q.business.groupId, stateCode: q.business.stateCode }),
    getCreditSummary(q.business.id),
    q.pincode ? db.deliveryZone.findFirst({ where: { isActive: true, pincodes: { has: q.pincode } }, select: { name: true, deliveryFee: true } }) : null,
    db.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { stateCode: true } }),
  ]);
  const editable = q.status === "REQUESTED" || q.status === "QUOTED";

  return (
    <>
      <Link href="/admin/quotations" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Quotations
      </Link>
      <PageHeader
        title={`Quotation ${q.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <QuotationBadge status={q.status} />
            <Link href={`/admin/businesses/${q.business.id}`} className="font-semibold text-brand-deep hover:underline">
              {q.business.tradeName || q.business.legalName}
            </Link>
            · requested {formatDateTime(q.createdAt)}
            {q.order && <> · became order {q.order.orderNumber}</>}
          </span>
        }
      />
      <QuotationEditor
        editable={editable}
        quote={{
          id: q.id,
          status: q.status,
          fulfilment: q.fulfilment,
          discount: q.discount,
          deliveryFee: q.deliveryFee,
          validUntil: q.validUntil ? istDateKey(q.validUntil) : "",
          staffNote: q.staffNote ?? "",
          requestNote: q.requestNote ?? "",
          placeOfSupply: `${stateName(q.placeOfSupply)} (${q.placeOfSupply})`,
          interState: q.placeOfSupply !== settings.stateCode,
          address: address ? [address.label, address.line1, address.area, address.city, address.pincode].join(", ") : null,
          zone: zone ? { name: zone.name, deliveryFee: zone.deliveryFee } : null,
          totals: { subtotal: q.subtotal, discount: q.discount, deliveryFee: q.deliveryFee, cgst: q.cgst, sgst: q.sgst, igst: q.igst, taxTotal: q.taxTotal, total: q.total },
        }}
        items={q.items.map((i) => ({
          id: i.id,
          name: i.productName,
          size: i.size,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          gstRateBps: i.gstRateBps,
          currentPrice: priceFor(ctx, i.variant, i.quantity)?.unitPrice ?? null,
          basePrice: i.variant.wholesalePrice,
          moq: i.variant.moq,
        }))}
        credit={{ isActive: credit.isActive, available: credit.available, outstanding: credit.outstanding }}
      />
    </>
  );
}
