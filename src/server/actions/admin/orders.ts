"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction, requireRoleForAction } from "@/server/auth-guard";
import { canTransition, ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { deductStockForOrder, restoreStockForOrder } from "@/server/inventory";
import { allocateBatchesForOrder, restoreBatchesForOrder, StockError } from "@/server/batches";
import { cancelInvoiceForOrder, issueInvoice } from "@/server/invoices";
import { PaymentError, recordOrderPayment } from "@/server/payments";
import { audit } from "@/server/audit";
import { parseISTDate } from "@/lib/dates";
import { PAYMENT_MODES } from "@/lib/types";

const statusSchema = z.object({
  orderId: z.string().min(1),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional().default(""),
});

/**
 * Move an order to a new status. Transition rules are enforced here (not just in the UI),
 * stock is deducted on CONFIRMED and restored on cancellation – all in one transaction.
 * Retail orders use ingredient stock; wholesale orders use finished-product batches (FIFO by
 * expiry), get their GST invoice on dispatch and update the delivery record.
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
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, status: true, fulfilment: true, channel: true, paymentMethod: true, total: true, amountPaid: true },
      });
      if (!order) return { ok: false as const, error: "Order not found" };
      const from = order.status as OrderStatus;
      const wholesale = order.channel === "WHOLESALE";
      const dispatch = to === "OUT_FOR_DELIVERY" || to === "READY_FOR_PICKUP";
      if (wholesale && dispatch && order.paymentMethod === "BANK_TRANSFER" && order.amountPaid < order.total) {
        return { ok: false as const, error: "This order is paid in advance – record the payment before dispatching it." };
      }
      if (!canTransition(from, to, order.fulfilment, order.channel)) {
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
      if (wholesale) {
        if (to === "CONFIRMED") await allocateBatchesForOrder(tx, orderId, staff.id, order.orderNumber);
        if (to === "CANCELLED") {
          await restoreBatchesForOrder(tx, orderId, staff.id, order.orderNumber);
          await cancelInvoiceForOrder(tx, orderId, note || "Order cancelled", staff.id);
        }
        if (dispatch) {
          await issueInvoice(tx, orderId, staff.id);
          await tx.delivery.updateMany({ where: { orderId }, data: { status: "DISPATCHED", dispatchedAt: new Date() } });
        }
        if (to === "DELIVERED") await tx.delivery.updateMany({ where: { orderId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
        await audit(
          { staffId: staff.id },
          { action: "order.status", entityType: "Order", entityId: orderId, summary: order.orderNumber + ": " + STATUS_LABELS[from] + " → " + STATUS_LABELS[to] + (note ? " (" + note + ")" : "") },
          tx,
        );
      } else {
        if (to === "CONFIRMED") await deductStockForOrder(tx, orderId, staff.id, order.orderNumber);
        if (to === "CANCELLED") await restoreStockForOrder(tx, orderId, staff.id, order.orderNumber);
      }
      return { ok: true as const, message: `${order.orderNumber} → ${STATUS_LABELS[to]}` };
    }).catch((e: unknown) => {
      if (e instanceof StockError) return { ok: false as const, error: e.message };
      throw e;
    });

    revalidatePath("/admin", "layout");
    return result;
  });
}

/** Mark a cash / pay-at-shop order as paid (any staff role). */
export async function markOrderPaid(orderId: string) {
  return adminAction("orders", async (staff) => {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, status: true, orderNumber: true, channel: true } });
    if (!order) return { ok: false, error: "Order not found" };
    if (order.channel === "WHOLESALE") return { ok: false, error: "Record wholesale payments with “Record payment”." };
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
    const order = await db.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, status: true, orderNumber: true, channel: true } });
    if (!order) return { ok: false, error: "Order not found" };
    if (order.channel === "WHOLESALE") return { ok: false, error: "Refund wholesale payments from the payments section." };
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
      business: { select: { id: true, legalName: true, tradeName: true, gstin: true } },
      delivery: true,
      invoice: { select: { number: true, status: true, dueDate: true } },
      payments: { orderBy: { receivedAt: "asc" } },
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
    address: [o.addressLine1, o.addressLine2, o.landmark, o.area, o.city, o.pincode].filter(Boolean).join(", "),
    channel: o.channel,
    business: o.business ? { id: o.business.id, name: o.business.tradeName || o.business.legalName, gstin: o.business.gstin } : null,
    poNumber: o.poNumber,
    poDate: o.poDate?.toISOString() ?? null,
    placeOfSupply: o.placeOfSupply,
    cgst: o.cgst,
    sgst: o.sgst,
    igst: o.igst,
    taxTotal: o.taxTotal,
    amountPaid: o.amountPaid,
    delivery: o.delivery
      ? {
          scheduledDate: o.delivery.scheduledDate.toISOString(),
          slot: o.delivery.slot,
          status: o.delivery.status,
          driverName: o.delivery.driverName,
          vehicle: o.delivery.vehicle,
          receivedBy: o.delivery.receivedBy,
          confirmedByBusinessAt: o.delivery.confirmedByBusinessAt?.toISOString() ?? null,
        }
      : null,
    invoice: o.invoice ? { number: o.invoice.number, status: o.invoice.status, dueDate: o.invoice.dueDate.toISOString() } : null,
    payments: o.payments.map((p) => ({ id: p.id, kind: p.kind, amount: p.amount, mode: p.mode, reference: p.reference, receivedAt: p.receivedAt.toISOString() })),
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
      gstRateBps: i.gstRateBps,
      hsnCode: i.hsnCode,
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

// ───────────────────────── Wholesale payments & invoices ─────────────────────────

const paymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().min(1, "Enter an amount").max(1_000_000_000),
  mode: z.enum(PAYMENT_MODES),
  reference: z.string().trim().max(60).optional().default(""),
  note: z.string().trim().max(200).optional().default(""),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
});

export type RecordPaymentInput = z.input<typeof paymentSchema>;

async function paymentEntry(kind: "PAYMENT" | "REFUND", input: RecordPaymentInput) {
  return adminAction(kind === "PAYMENT" ? "payments" : "paymentsRefund", async (staff) => {
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const p = parsed.data;
    const receivedAt = parseISTDate(p.receivedAt);
    if (!receivedAt || receivedAt.getTime() > Date.now()) return { ok: false, error: "The date can't be in the future." };
    if (kind === "REFUND" && p.note.length < 3) return { ok: false, error: "Please give a refund reason." };
    try {
      const { status } = await db.$transaction((tx) =>
        recordOrderPayment(tx, { orderId: p.orderId, kind, amount: p.amount, mode: p.mode, reference: p.reference || null, note: p.note || null, receivedAt, staffId: staff.id }),
      );
      revalidatePath("/admin", "layout");
      revalidatePath("/business", "layout");
      return { ok: true, message: kind === "PAYMENT" ? (status === "PAID" ? "Payment recorded – fully paid" : "Payment recorded") : "Refund recorded" };
    } catch (e) {
      if (e instanceof PaymentError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

/** Record a full, partial or advance payment on a wholesale order (any staff role). */
export async function recordPayment(input: RecordPaymentInput) {
  return paymentEntry("PAYMENT", input);
}

/** Refund part or all of what was paid (OWNER / MANAGER). */
export async function recordRefund(input: RecordPaymentInput) {
  return paymentEntry("REFUND", input);
}

/** Issue the GST invoice now (it is also issued automatically on dispatch). */
export async function generateInvoice(orderId: string) {
  return adminAction<{ number: string }>("invoices", async (staff) => {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { channel: true, status: true } });
    if (!order || order.channel !== "WHOLESALE") return { ok: false, error: "Invoices are for wholesale orders." };
    if (order.status === "PLACED") return { ok: false, error: "Confirm the order before invoicing it." };
    if (order.status === "CANCELLED" || order.status === "REJECTED") return { ok: false, error: "This order was cancelled." };
    const inv = await db.$transaction((tx) => issueInvoice(tx, orderId, staff.id));
    revalidatePath("/admin", "layout");
    revalidatePath("/business", "layout");
    return { ok: true, message: `Invoice ${inv.number} issued`, data: { number: inv.number } };
  });
}
