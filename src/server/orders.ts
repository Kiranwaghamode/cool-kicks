import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/lib/order-status";
import type { Fulfilment, Level, PaymentMethod, PaymentStatus, Size } from "@/lib/types";

/** Order data safe to show to the customer who owns it (no address details beyond area). */
export async function getCustomerOrder(orderNumber: string) {
  const o = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: { orderBy: { id: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
      reviews: { select: { id: true } },
    },
  });
  if (!o) return null;
  return toCustomerOrder(o);
}

/** Lookup for tracking: requires order number AND phone to match. */
export async function findOrderForTracking(orderNumber: string, phone: string) {
  const o = await db.order.findFirst({
    where: { orderNumber, customerPhone: phone },
    include: {
      items: { orderBy: { id: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
      reviews: { select: { id: true } },
    },
  });
  return o ? toCustomerOrder(o) : null;
}

type FullOrder = Prisma.OrderGetPayload<{ include: { items: true; history: true; reviews: { select: { id: true } } } }>;

function toCustomerOrder(o: FullOrder) {
  return {
    orderNumber: o.orderNumber,
    customerName: o.customerName.split(" ")[0],
    fulfilment: o.fulfilment as Fulfilment,
    area: o.area,
    status: o.status as OrderStatus,
    paymentMethod: o.paymentMethod as PaymentMethod,
    paymentStatus: o.paymentStatus as PaymentStatus,
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    total: o.total,
    couponCode: o.couponCode,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    hasReview: o.reviews.length > 0,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      size: i.size as Size,
      sugarLevel: i.sugarLevel as Level,
      iceLevel: i.iceLevel as Level,
      instructions: i.instructions,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    history: o.history.map((h) => ({
      toStatus: h.toStatus as OrderStatus,
      note: h.toStatus === "CANCELLED" || h.toStatus === "REJECTED" ? h.note : null,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;
