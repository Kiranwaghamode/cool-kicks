import { requireBusiness } from "@/server/business-auth";
import { getWholesaleCatalogue } from "@/server/wholesale";
import { db } from "@/lib/db";
import { CatalogueView } from "./catalogue-view";

export const metadata = { title: "Wholesale catalogue" };

export default async function CataloguePage() {
  const business = await requireBusiness({ approved: true });
  const [products, settings] = await Promise.all([
    getWholesaleCatalogue(business),
    db.shopSettings.findUnique({ where: { id: 1 }, select: { wholesaleEnabled: true, wholesaleMinOrder: true } }),
  ]);
  return <CatalogueView products={products} minOrder={settings?.wholesaleMinOrder ?? 0} paused={!settings?.wholesaleEnabled} />;
}
