import { PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { addDays, istDateKey, parseISTDate, startOfDayIST } from "@/lib/dates";
import { DeliveryBoard, type DeliveryCard } from "./delivery-board";

export const metadata = { title: "Deliveries" };

export default async function DeliveriesPage({ searchParams }: PageProps<"/admin/deliveries">) {
  await requireRole("deliveries");
  const sp = await searchParams;
  const today = startOfDayIST();
  const from = (typeof sp.from === "string" && parseISTDate(sp.from)) || today;
  const days = sp.days === "1" ? 1 : sp.days === "30" ? 30 : 7;
  const end = addDays(from, days);

  const rows = await db.delivery.findMany({
    where: {
      order: { status: { notIn: ["CANCELLED", "REJECTED"] } },
      OR: [
        { scheduledDate: { gte: from, lt: end } },
        // Overdue: still open but scheduled before today.
        { scheduledDate: { lt: today }, status: { not: "DELIVERED" }, order: { status: { not: "DELIVERED" } } },
      ],
    },
    orderBy: [{ scheduledDate: "asc" }, { slot: "asc" }],
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          fulfilment: true,
          total: true,
          amountPaid: true,
          paymentMethod: true,
          customerPhone: true,
          addressLine1: true,
          area: true,
          city: true,
          pincode: true,
          business: { select: { legalName: true, tradeName: true } },
          _count: { select: { items: true } },
          items: { select: { quantity: true } },
        },
      },
    },
  });

  const cards: DeliveryCard[] = rows.map((d) => ({
    orderId: d.order.id,
    orderNumber: d.order.orderNumber,
    business: d.order.business ? d.order.business.tradeName || d.order.business.legalName : "—",
    phone: d.order.customerPhone,
    fulfilment: d.order.fulfilment,
    orderStatus: d.order.status,
    paymentMethod: d.order.paymentMethod,
    due: Math.max(0, d.order.total - d.order.amountPaid),
    address: [d.order.addressLine1, d.order.area, d.order.city, d.order.pincode].filter(Boolean).join(", "),
    units: d.order.items.reduce((s, i) => s + i.quantity, 0),
    date: istDateKey(d.scheduledDate),
    slot: d.slot,
    status: d.status,
    driverName: d.driverName ?? "",
    driverPhone: d.driverPhone ?? "",
    vehicle: d.vehicle ?? "",
    note: d.note ?? "",
    overdue: d.scheduledDate < today,
    receivedBy: d.receivedBy,
  }));

  return (
    <>
      <PageHeader title="Deliveries" description="Scheduled wholesale deliveries and pickups. Assign drivers, dispatch, and confirm who received the goods." />
      <DeliveryBoard cards={cards} from={istDateKey(from)} days={days} today={istDateKey(today)} />
    </>
  );
}
