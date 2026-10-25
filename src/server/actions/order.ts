"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { cartInputSchema, checkoutSchema } from "@/lib/validation";
import { priceCart } from "@/server/cart";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { rememberOrder } from "@/server/recent-orders";
import { formatPaise } from "@/lib/money";

const placeOrderSchema = z.object({
  idempotencyKey: z.string().uuid("Please refresh the page and try again."),
  cart: cartInputSchema.omit({ pincode: true }),
  details: checkoutSchema,
});

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
export type PlaceOrderResult =
  | { ok: true; orderNumber: string; phone: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; refreshCart?: boolean };

class OrderError extends Error {
  constructor(
    message: string,
    public refreshCart = false,
  ) {
    super(message);
  }
}

async function nextOrderNumber(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  return `CK-${row.n.toString()}`;
}

/**
 * Place an order. Everything is re-validated and re-priced here – the browser only sends
 * product ids, options and quantities.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.filter((p) => p !== "details").join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const { idempotencyKey, cart, details } = parsed.data;

  // Duplicate submission (double click / retry): return the existing order.
  const existing = await db.order.findUnique({
    where: { idempotencyKey },
    select: { orderNumber: true, customerPhone: true },
  });
  if (existing) {
    await rememberOrder(existing.orderNumber);
    return { ok: true, orderNumber: existing.orderNumber, phone: existing.customerPhone };
  }

  // Rate limits: per IP and per phone.
  const ip = await clientIp();
  const [ipOk, phoneOk] = await Promise.all([
    rateLimit(`order:ip:${ip}`, 8, 10 * 60),
    rateLimit(`order:phone:${details.customerPhone}`, 5, 10 * 60),
  ]);
  if (!ipOk || !phoneOk) {
    return { ok: false, error: "Too many orders in a short time. Please wait a few minutes or call us." };
  }

  if (cart.lines.length === 0) return { ok: false, error: "Your cart is empty." };
  if (cart.fulfilment !== details.fulfilment) return { ok: false, error: "Please choose pickup or delivery again.", refreshCart: true };

  try {
    const order = await db.$transaction(
      async (tx) => {
        const priced = await priceCart(
          { ...cart, pincode: details.fulfilment === "DELIVERY" ? details.pincode : "" },
          tx,
        );
        const s = priced.shop;

        if (!s.status.isOpen) throw new OrderError(`${s.status.message}. Please order when we're open.`);
        if (details.fulfilment === "PICKUP" && !s.pickupEnabled) throw new OrderError("Pickup is not available right now.");
        if (details.fulfilment === "DELIVERY" && !s.deliveryEnabled) throw new OrderError("Delivery is not available right now.");
        if (details.paymentMethod === "CASH_ON_DELIVERY" && !s.codEnabled)
          throw new OrderError("Cash on Delivery is not available right now.");
        if (details.paymentMethod === "PAY_AT_SHOP" && !s.payAtShopEnabled)
          throw new OrderError("Pay at Shop is not available right now.");

        const unavailable = priced.lines.filter((l) => !l.available);
        if (unavailable.length)
          throw new OrderError(
            `${unavailable.map((l) => l.name).join(", ")} ${unavailable.length === 1 ? "is" : "are"} no longer available. Please update your cart.`,
            true,
          );
        const changed = priced.lines.filter((l) => l.priceChanged);
        if (changed.length)
          throw new OrderError("Some prices have changed. Please review your cart before placing the order.", true);

        if (details.fulfilment === "DELIVERY" && !priced.zone)
          throw new OrderError(`Sorry, we don't deliver to ${details.pincode} yet.`);
        if (!priced.totals.meetsMinimum)
          throw new OrderError(
            `The minimum order is ${formatPaise(s.minOrderAmount)}. Add ${formatPaise(priced.totals.minOrderShortfall)} more.`,
          );

        // Coupon: only count it if it actually gave a discount. Guard the usage limit atomically.
        let couponCode: string | null = null;
        if (priced.coupon && priced.totals.couponApplied) {
          const updated = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
            WHERE "code" = ${priced.coupon.code} AND "isActive" = true
              AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
          if (updated === 0) throw new OrderError(`${priced.coupon.code} can no longer be used.`, true);
          couponCode = priced.coupon.code;
        } else if (cart.couponCode && priced.coupon && !priced.coupon.applied) {
          throw new OrderError(priced.coupon.message ?? `${cart.couponCode} can't be applied.`, true);
        }

        const orderNumber = await nextOrderNumber(tx);
        const isDelivery = details.fulfilment === "DELIVERY";

        return tx.order.create({
          data: {
            orderNumber,
            idempotencyKey,
            customerName: details.customerName,
            customerPhone: details.customerPhone,
            customerEmail: details.customerEmail || null,
            fulfilment: details.fulfilment,
            addressLine1: isDelivery ? details.addressLine1 : null,
            addressLine2: isDelivery ? details.addressLine2 || null : null,
            landmark: isDelivery ? details.landmark || null : null,
            area: isDelivery ? details.area : null,
            pincode: isDelivery ? details.pincode : null,
            deliveryZoneId: isDelivery ? priced.zone!.id : null,
            subtotal: priced.totals.subtotal,
            discount: priced.totals.discount,
            deliveryFee: priced.totals.deliveryFee,
            total: priced.totals.total,
            couponCode,
            paymentMethod: details.paymentMethod,
            paymentStatus: "PENDING",
            status: "PLACED",
            notes: details.notes || null,
            items: {
              create: priced.lines.map((l) => ({
                productId: l.productId,
                productName: l.name,
                size: l.size,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                sugarLevel: l.sugar,
                iceLevel: l.ice,
                instructions: l.instructions || null,
                lineTotal: l.lineTotal,
              })),
            },
            history: { create: { fromStatus: null, toStatus: "PLACED", note: "Order placed online" } },
          },
          select: { orderNumber: true, customerPhone: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
    );

    await rememberOrder(order.orderNumber);
    return { ok: true, orderNumber: order.orderNumber, phone: order.customerPhone };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message, refreshCart: e.refreshCart };
    // Two submissions raced with the same idempotency key – return the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const dup = await db.order.findUnique({ where: { idempotencyKey }, select: { orderNumber: true, customerPhone: true } });
      if (dup) {
        await rememberOrder(dup.orderNumber);
        return { ok: true, orderNumber: dup.orderNumber, phone: dup.customerPhone };
      }
    }
    console.error("placeOrder failed", e);
    return { ok: false, error: "Something went wrong while placing your order. Please try again." };
  }
}

/** Live pincode check for the checkout form. */
export async function checkPincode(pin: string): Promise<{ ok: boolean; message: string }> {
  if (!/^[1-9]\d{5}$/.test(pin)) return { ok: false, message: "Enter a valid 6-digit pincode" };
  const zone = await db.deliveryZone.findFirst({
    where: { isActive: true, pincodes: { has: pin } },
    select: { name: true, deliveryFee: true, freeDeliveryAbove: true },
  });
  if (!zone) return { ok: false, message: "Sorry, we don't deliver here yet" };
  const free = zone.freeDeliveryAbove ? ` · free above ${formatPaise(zone.freeDeliveryAbove)}` : "";
  return { ok: true, message: `We deliver here · ${formatPaise(zone.deliveryFee)} delivery${free}` };
}
