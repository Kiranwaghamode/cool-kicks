"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { audit } from "@/server/audit";
import { parseISTDate, startOfDayIST } from "@/lib/dates";
import { indianMobile } from "@/lib/validation";
import { DELIVERY_SLOTS } from "@/lib/types";
import { updateOrderStatus } from "@/server/actions/admin/orders";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/business", "layout");
}

const scheduleSchema = z.object({
  orderId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  slot: z.enum(DELIVERY_SLOTS),
  driverName: z.string().trim().max(60).optional().default(""),
  driverPhone: z.union([indianMobile, z.literal("")]).optional().default(""),
  vehicle: z.string().trim().max(30).optional().default(""),
  note: z.string().trim().max(200).optional().default(""),
});

export type DeliveryScheduleInput = z.input<typeof scheduleSchema>;

/** Reschedule a wholesale delivery and/or assign the driver and vehicle. */
export async function updateDelivery(input: DeliveryScheduleInput) {
  return adminAction("deliveries", async (staff) => {
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const v = parsed.data;
    const date = parseISTDate(v.scheduledDate);
    if (!date || date < startOfDayIST()) return { ok: false, error: "Choose today or a later date." };
    const d = await db.delivery.findUnique({ where: { orderId: v.orderId }, include: { order: { select: { orderNumber: true, status: true } } } });
    if (!d) return { ok: false, error: "Delivery not found" };
    if (d.status === "DELIVERED" || ["DELIVERED", "CANCELLED", "REJECTED"].includes(d.order.status)) return { ok: false, error: "This order is closed." };
    const moved = d.scheduledDate.getTime() !== date.getTime() || d.slot !== v.slot;
    await db.delivery.update({
      where: { orderId: v.orderId },
      data: {
        scheduledDate: date,
        slot: v.slot,
        driverName: v.driverName || null,
        driverPhone: v.driverPhone || null,
        vehicle: v.vehicle || null,
        note: v.note || null,
        // A failed delivery that is rescheduled goes back on the board.
        ...(d.status === "FAILED" && moved ? { status: d.order.status === "OUT_FOR_DELIVERY" ? "DISPATCHED" : "SCHEDULED" } : {}),
      },
    });
    await audit(
      { staffId: staff.id },
      { action: "delivery.update", entityType: "Order", entityId: v.orderId, summary: `${d.order.orderNumber}: delivery ${moved ? `moved to ${v.scheduledDate} ${v.slot.toLowerCase()}` : "details updated"}${v.driverName ? ` · driver ${v.driverName}` : ""}` },
    );
    refresh();
    return { ok: true, message: moved ? "Delivery rescheduled" : "Delivery updated" };
  });
}

/** The driver couldn't deliver – keep the order dispatched and flag it for rescheduling. */
export async function markDeliveryFailed(orderId: string, note: string) {
  return adminAction("deliveries", async (staff) => {
    const why = note.trim();
    if (why.length < 3) return { ok: false, error: "Say what went wrong." };
    const d = await db.delivery.findUnique({ where: { orderId }, include: { order: { select: { orderNumber: true, status: true } } } });
    if (!d || d.order.status !== "OUT_FOR_DELIVERY") return { ok: false, error: "Only dispatched deliveries can be marked failed." };
    await db.delivery.update({ where: { orderId }, data: { status: "FAILED", note: why.slice(0, 200) } });
    await audit({ staffId: staff.id }, { action: "delivery.failed", entityType: "Order", entityId: orderId, summary: `${d.order.orderNumber}: delivery failed – ${why}` });
    refresh();
    return { ok: true, message: "Marked as failed – reschedule it" };
  });
}

/** Confirm delivery (or pickup) with the receiver's name. */
export async function confirmDelivered(orderId: string, receivedBy: string) {
  const name = receivedBy.trim().slice(0, 60);
  if (name.length < 2) return { ok: false as const, error: "Enter who received the goods." };
  const res = await updateOrderStatus({ orderId, to: "DELIVERED", note: `Received by ${name}` });
  if (!res.ok) return res;
  return adminAction("deliveries", async () => {
    await db.delivery.updateMany({ where: { orderId }, data: { receivedBy: name } });
    refresh();
    return { ok: true, message: res.message };
  });
}
