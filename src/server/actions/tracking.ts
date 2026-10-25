"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { indianMobile, orderNumber as orderNumberSchema, trackSchema } from "@/lib/validation";
import { findOrderForTracking, type CustomerOrder } from "@/server/orders";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { lineKey } from "@/lib/cart-line";
import type { Level, Size } from "@/lib/types";

export type TrackResult = { ok: true; order: CustomerOrder } | { ok: false; error: string };

/** Look up an order – order number AND phone must both match. */
export async function trackOrder(input: { orderNumber: string; phone: string }): Promise<TrackResult> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  const ip = await clientIp();
  if (!(await rateLimit(`track:ip:${ip}`, 60, 10 * 60))) {
    return { ok: false, error: "Too many lookups. Please wait a few minutes." };
  }
  const order = await findOrderForTracking(parsed.data.orderNumber, parsed.data.phone);
  if (!order) return { ok: false, error: "We couldn't find an order with that number and phone. Please check both." };
  return { ok: true, order };
}

const myOrdersSchema = z
  .array(z.object({ orderNumber: orderNumberSchema, phone: indianMobile }))
  .max(30);

export type MyOrderSummary = Pick<
  CustomerOrder,
  "orderNumber" | "status" | "fulfilment" | "total" | "createdAt" | "paymentStatus" | "paymentMethod"
> & { phone: string; itemCount: number; itemsPreview: string };

/** Live status for orders saved on this device. Each entry must match number + phone. */
export async function getMyOrders(list: { orderNumber: string; phone: string }[]): Promise<MyOrderSummary[]> {
  const parsed = myOrdersSchema.safeParse(list);
  if (!parsed.success || parsed.data.length === 0) return [];
  const ip = await clientIp();
  if (!(await rateLimit(`myorders:ip:${ip}`, 60, 10 * 60))) return [];
  const orders = await db.order.findMany({
    where: { OR: parsed.data.map((o) => ({ orderNumber: o.orderNumber, customerPhone: o.phone })) },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { productName: true, quantity: true } } },
  });
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    phone: o.customerPhone,
    status: o.status,
    fulfilment: o.fulfilment,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    itemsPreview: o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", "),
  }));
}

export type ReorderResult =
  | {
      ok: true;
      lines: {
        key: string;
        productId: string;
        slug: string;
        name: string;
        image: string | null;
        size: Size;
        sugar: Level;
        ice: Level;
        instructions: string;
        quantity: number;
        unitPrice: number;
      }[];
      skipped: string[];
    }
  | { ok: false; error: string };

/** Items from a past order that can be ordered again (current prices, skipping unavailable ones). */
export async function getReorderItems(input: { orderNumber: string; phone: string }): Promise<ReorderResult> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Order not found." };
  const order = await db.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, customerPhone: parsed.data.phone },
    include: { items: { include: { product: { include: { variants: true, category: true } } } } },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const lines: Extract<ReorderResult, { ok: true }>["lines"] = [];
  const skipped: string[] = [];
  for (const i of order.items) {
    const p = i.product;
    const v = p.variants.find((x) => x.size === i.size);
    if (!p.isActive || !p.isAvailable || !p.category.isActive || !v || !v.isAvailable) {
      skipped.push(i.productName);
      continue;
    }
    const instructions = i.instructions ?? "";
    lines.push({
      key: lineKey({ productId: p.id, size: i.size, sugar: i.sugarLevel, ice: i.iceLevel, instructions }),
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.image,
      size: i.size,
      sugar: i.sugarLevel,
      ice: i.iceLevel,
      instructions,
      quantity: i.quantity,
      unitPrice: v.price,
    });
  }
  return { ok: true, lines, skipped };
}

const reviewSchema = z.object({
  orderNumber: orderNumberSchema,
  phone: indianMobile,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5, "Please write a few words").max(500),
});

/** Review form on the tracking page – only for delivered orders, verified by number + phone. */
export async function submitReview(input: z.input<typeof reviewSchema>): Promise<{ ok: boolean; message: string }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your review." };
  const ip = await clientIp();
  if (!(await rateLimit(`review:ip:${ip}`, 5, 60 * 60))) return { ok: false, message: "Too many reviews. Try later." };
  const order = await db.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, customerPhone: parsed.data.phone },
    include: { reviews: { select: { id: true } }, items: { select: { productId: true }, take: 1 } },
  });
  if (!order) return { ok: false, message: "Order not found." };
  if (order.status !== "DELIVERED") return { ok: false, message: "You can review once your order is delivered." };
  if (order.reviews.length) return { ok: false, message: "You've already reviewed this order. Thank you!" };
  await db.review.create({
    data: {
      customerName: order.customerName.split(" ").map((s, i) => (i === 0 ? s : `${s[0]}.`)).join(" "),
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      orderId: order.id,
      productId: order.items[0]?.productId ?? null,
      isApproved: false,
    },
  });
  return { ok: true, message: "Thanks for your review! It will appear once approved." };
}
