"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction, requireRoleForAction } from "@/server/auth-guard";
import { canTransition, ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { deductStockForOrder, restoreStockForOrder } from "@/server/inventory";

const statusSchema = z.object({
  orderId: z.string().min(1),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional().default(""),
});

/**
 * Move an order to a new status. Transition rules are enforced here (not just in the UI),
 * stock is deducted on CONFIRMED and restored on cancellation – all in one transaction.
 */
export async function updateOrderStatus(input: z.input<typeof statusSchema>) {
  return adminAction("orders", async (staff) => {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request" };
    const { orderId, to, note } = parsed.data;
    if ((to === "CANCELLED" || to === "REJECTED") && note.length < 3) {
      return { ok: false, error: "Please give a reason (the customer will see it)." };
    }

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, status: true, fulfilment: true } });
      if (!order) return { ok: false as const, error: "Order not found" };
      const from = order.status as OrderStatus;
      if (!canTransition(from, to, order.fulfilment)) {
        return { ok: false as const, error: `Can't move an order from “${STATUS_LABELS[from]}” to “${STATUS_LABELS[to]}”.` };
      }
      // Guard against two staff updating at once.
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data: { status: to, ...(to === "CANCELLED" || to === "REJECTED" ? { cancelReason: note } : {}) },
      });
      if (updated.count === 0) return { ok: false as const, error: "This order was just updated by someone else. Refresh and try again." };

      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: from, toStatus: to, changedById: staff.id, note: note || null },
      });
      if (to === "CONFIRMED") await deductStockForOrder(tx, orderId, staff.id, order.orderNumber);
      if (to === "CANCELLED") await restoreStockForOrder(tx, orderId, staff.id, order.orderNumber);
      return { ok: true as const, message: `${order.orderNumber} → ${STATUS_LABELS[to]}` };
    });

    revalidatePath("/admin", "layout");
    return result;
  });
}

/** Mark a cash / pay-at-shop order as paid (any staff role). */
export async function markOrderPaid(orderId: string) {
  return adminAction("orders", async (staff) => {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, status: true, orderNumber: true } });
    if (!order) return { ok: false, error: "Order not found" };
    if (order.paymentStatus === "PAID") return { ok: false, error: "Already marked as paid" };
    if (order.status === "REJECTED") return { ok: false, error: "Rejected orders can't be paid" };
    await db.$transaction([
      db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", paidAt: new Date(), paidById: staff.id } }),
      db.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: order.status, changedById: staff.id, note: "Payment received" },
      }),
    ]);
    revalidatePath("/admin", "layout");
    return { ok: true, message: `${order.orderNumber} marked as paid` };
  });
}

/** Record a refund (OWNER / MANAGER only). */
export async function refundOrder(orderId: string, reason: string) {
  return adminAction("ordersRefund", async (staff) => {
    const why = reason.trim();
    if (why.length < 3) return { ok: false, error: "Please give a refund reason." };
    const order = await db.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, status: true, orderNumber: true } });
    if (!order) return { ok: false, error: "Order not found" };
    if (order.paymentStatus !== "PAID") return { ok: false, error: "Only paid orders can be refunded" };
    await db.$transaction([
      db.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED", refundedAt: new Date(), refundedById: staff.id } }),
      db.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: order.status, changedById: staff.id, note: `Refunded: ${why.slice(0, 250)}` },
      }),
    ]);
    revalidatePath("/admin", "layout");
    return { ok: true, message: `${order.orderNumber} marked as refunded` };
  });
}

/** Full order details for the admin drawer (includes customer contact + address). */
export async function getAdminOrder(orderNumber: string) {
  await requireRoleForAction("orders");
  const o = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: { orderBy: { id: "asc" } },
      history: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      deliveryZone: { select: { name: true } },
    },
  });
  if (!o) return null;
  const staffIds = [o.paidById, o.refundedById].filter(Boolean) as string[];
  const people = staffIds.length ? await db.staffUser.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [];
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    fulfilment: o.fulfilment,
    address: [o.addressLine1, o.addressLine2, o.landmark, o.area, o.pincode].filter(Boolean).join(", "),
    zone: o.deliveryZone?.name ?? null,
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    total: o.total,
    couponCode: o.couponCode,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paidAt: o.paidAt?.toISOString() ?? null,
    paidBy: nameOf(o.paidById),
    refundedAt: o.refundedAt?.toISOString() ?? null,
    refundedBy: nameOf(o.refundedById),
    status: o.status as OrderStatus,
    notes: o.notes,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      size: i.size,
      sugarLevel: i.sugarLevel,
      iceLevel: i.iceLevel,
      instructions: i.instructions,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    history: o.history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus as OrderStatus | null,
      toStatus: h.toStatus as OrderStatus,
      note: h.note,
      by: h.changedBy?.name ?? (h.fromStatus === null ? "Customer" : "System"),
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
