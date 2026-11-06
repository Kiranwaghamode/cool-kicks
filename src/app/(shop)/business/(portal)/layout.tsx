import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { PortalNav } from "@/components/shop/business/portal-nav";
import { BulkCartOwner } from "@/components/shop/business/bulk-cart-owner";
import { requireBusiness } from "@/server/business-auth";
import { BUSINESS_STATUS_LABELS, BUSINESS_TYPE_LABELS, type BusinessStatus } from "@/lib/types";
import { getShopName } from "@/server/brand";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return {
    title: { default: "Business account", template: `%s | ${name} Business` },
    robots: { index: false, follow: false },
  };
}

const STATUS_TONE: Record<BusinessStatus, BadgeTone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" };

export default async function BusinessPortalLayout({ children }: { children: React.ReactNode }) {
  const business = await requireBusiness();
  return (
    <div className="bg-cream-50 pb-16">
      <BulkCartOwner businessId={business.id} />
      <div className="border-b border-line bg-cream">
        <div className="container-page py-5 md:py-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-deep text-white">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg leading-tight font-extrabold">{business.displayName}</p>
              <p className="text-sm text-ink-soft">
                {BUSINESS_TYPE_LABELS[business.type]} · {business.contactName}
              </p>
            </div>
            <Badge tone={STATUS_TONE[business.status]}>{BUSINESS_STATUS_LABELS[business.status]}</Badge>
          </div>
          <PortalNav approved={business.status === "APPROVED"} />
        </div>
      </div>
      <div className="container-page pt-6 md:pt-8">{children}</div>
    </div>
  );
}
