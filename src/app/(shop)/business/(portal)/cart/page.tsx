import { requireBusiness } from "@/server/business-auth";
import { db } from "@/lib/db";
import { BulkCartView } from "./bulk-cart-view";

export const metadata = { title: "Bulk cart" };

export default async function BulkCartPage() {
  const business = await requireBusiness({ approved: true });
  const addresses = await db.businessAddress.findMany({
    where: { businessId: business.id, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, label: true, line1: true, area: true, city: true, pincode: true, isDefault: true },
  });
  return <BulkCartView addresses={addresses} />;
}
