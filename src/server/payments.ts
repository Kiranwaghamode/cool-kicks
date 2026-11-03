import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMode } from "@/lib/types";
import { paymentStatusFor } from "@/lib/credit";
import { formatPaise } from "@/lib/money";
import { audit } from "@/server/audit";

type Tx = Prisma.TransactionClient;

export class PaymentError extends Error {}

/**
 * Record a payment (or refund) against an order. The order's `amountPaid` is updated with a
 * guarded UPDATE so concurrent entries can't overpay or over-refund.
 */
export async function recordOrderPayment(
  tx: Tx,
  args: { orderId: string; kind: "PAYMENT" | "REFUND"; amount: number; mode: PaymentMode; reference: string | null; note: string | null; receivedAt: Date; staffId: string },
) {
  const { orderId, kind, amount } = args;
  if (!Number.isInteger(amount) || amount <= 0) throw new PaymentError("Enter an amount above zero.");

  const order = await tx.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, total: true, amountPaid: true, status: true, businessId: true } });
  if (!order) throw new PaymentError("Order not found");
  if (kind === "PAYMENT" && order.status === "REJECTED") throw new PaymentError("Rejected orders can't take payments.");

  const updated =
    kind === "PAYMENT"
      ? await tx.$executeRaw`UPDATE "Order" SET "amountPaid" = "amountPaid" + ${amount}, "updatedAt" = now() WHERE "id" = ${orderId} AND "amountPaid" + ${amount} <= "total"`
      : await tx.$executeRaw`UPDATE "Order" SET "amountPaid" = "amountPaid" - ${amount}, "updatedAt" = now() WHERE "id" = ${orderId} AND "amountPaid" >= ${amount}`;
  if (updated === 0)
    throw new PaymentError(
      kind === "PAYMENT"
        ? `That's more than the balance due (${formatPaise(Math.max(0, order.total - order.amountPaid))}).`
        : `You can refund at most ${formatPaise(order.amountPaid)}.`,
    );

  const payment = await tx.payment.create({
    data: {
      orderId,
      businessId: order.businessId,
      kind,
      amount,
      mode: args.mode,
      reference: args.reference,
      note: args.note,
      receivedAt: args.receivedAt,
      recordedById: args.staffId,
    },
  });

  const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { total: true, amountPaid: true, paidAt: true } });
  const hadRefund = kind === "REFUND" || (await tx.payment.count({ where: { orderId, kind: "REFUND" } })) > 0;
  const status = paymentStatusFor(fresh.total, fresh.amountPaid, hadRefund);
  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: status,
      ...(status === "PAID" && !fresh.paidAt ? { paidAt: new Date(), paidById: args.staffId } : {}),
      ...(status === "REFUNDED" ? { refundedAt: new Date(), refundedById: args.staffId } : {}),
    },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      changedById: args.staffId,
      note: `${kind === "PAYMENT" ? "Payment received" : "Refund"}: ${formatPaise(amount)} (${args.mode.toLowerCase().replace("_", " ")})${args.reference ? ` ref ${args.reference}` : ""}`,
    },
  });
  await audit(
    { staffId: args.staffId },
    { action: kind === "PAYMENT" ? "payment.record" : "payment.refund", entityType: "Order", entityId: orderId, summary: `${kind === "PAYMENT" ? "Recorded payment" : "Refunded"} ${formatPaise(amount)} on ${order.orderNumber}` },
    tx,
  );
  return { payment, status };
}
