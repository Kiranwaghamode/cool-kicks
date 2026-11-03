import { PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { PricingManager } from "./pricing-manager";

export const metadata = { title: "Price lists" };

export default async function PricingPage() {
  await requireRole("pricing");
  const [groups, lists, variants] = await Promise.all([
    db.customerGroup.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { businesses: true } } } }),
    db.priceList.findMany({ orderBy: { name: "asc" }, include: { items: { select: { variantId: true, price: true } }, _count: { select: { groups: true } } } }),
    db.productVariant.findMany({
      where: { wholesaleEnabled: true, product: { isActive: true } },
      orderBy: [{ product: { name: "asc" } }, { volumeMl: "asc" }],
      select: { id: true, size: true, wholesalePrice: true, product: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Price lists"
        description="Each customer group uses one price list. Special prices on a business and volume discounts on products are applied on top."
      />
      <PricingManager
        groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description ?? "", priceListId: g.priceListId ?? "", isActive: g.isActive, businessCount: g._count.businesses }))}
        lists={lists.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description ?? "",
          discountBps: l.discountBps,
          isActive: l.isActive,
          groupCount: l._count.groups,
          items: Object.fromEntries(l.items.map((i) => [i.variantId, i.price])),
        }))}
        variants={variants.map((v) => ({ id: v.id, label: `${v.product.name} · ${v.size.toLowerCase()}`, basePrice: v.wholesalePrice }))}
      />
    </>
  );
}
