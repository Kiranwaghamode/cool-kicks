import { PageHeader } from "@/components/admin/ui";
import { ZoneManager } from "./zone-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Delivery zones" };

export default async function DeliveryZonesPage() {
  await requireRole("deliveryZones");
  const zones = await db.deliveryZone.findMany({ orderBy: [{ isActive: "desc" }, { deliveryFee: "asc" }], include: { _count: { select: { orders: true } } } });
  return (
    <>
      <PageHeader title="Delivery zones" description="Delivery is only offered to pincodes listed in an active zone." />
      <ZoneManager zones={zones.map((z) => ({ id: z.id, name: z.name, pincodes: z.pincodes, deliveryFee: z.deliveryFee, freeDeliveryAbove: z.freeDeliveryAbove, isActive: z.isActive, orders: z._count.orders }))} />
    </>
  );
}
