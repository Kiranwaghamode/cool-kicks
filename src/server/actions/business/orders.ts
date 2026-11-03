"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { bulkCartSchema, wholesaleCheckoutSchema } from "@/lib/b2b-validation";
import { addDays, istDateKey, startOfDayIST } from "@/lib/dates";
import type { BulkLine } from "@/lib/bulk-cart-store";
import type { ActionResult } from "@/server/auth-guard";
import { businessAction } from "@/server/business-auth";
import { getCreditSummary, type CreditSummary } from "@/server/credit";
import { priceBulkCart, type PricedBulkCart } from "@/server/wholesale";
import { createWholesaleOrder, MAX_SCHEDULE_DAYS, parseScheduleDate, WholesaleOrderError } from "@/server/wholesale-orders";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";

export type CheckoutOptions = {
  credit: CreditSummary;
  codEnabled: boolean;
  payAtShopEnabled: boolean;
  earliestDate: string;
  latestDate: string;
};

async function checkoutOptions(businessId: string): Promise<CheckoutOptions> {
  const [credit, s] = await Promise.all([
    getCreditSummary(businessId),
    db.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { codEnabled: true, payAtShopEnabled: true } }),
  ]);
  const tomorrow = addDays(startOfDayIST(), 1);
  return {
    credit,
    codEnabled: s.codEnabled,
    payAtShopEnabled: s.payAtShopEnabled,
    earliestDate: istDateKey(tomorrow),
    latestDate: istDateKey(addDays(tomorrow, MAX_SCHEDULE_DAYS - 1)),
  };
}

/** Re-price the bulk cart for the cart / checkout pages. */
export async function validateBulkCart(input: z.input<typeof bulkCartSchema>) {
  return businessAction<{ cart: PricedBulkCart; options: CheckoutOptions }>({ approved: true }, async (b) => {
    const parsed = bulkCartSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Your cart couldn't be read. Please refresh." };
    const [cart, options] = await Promise.all([priceBulkCart(b, parsed.data), checkoutOptions(b.id)]);
    return { ok: true, data: { cart, options } };
  });
}

const placeSchema = z.object({
  idempotencyKey: z.string().uuid("Please refresh the page and try again."),
  cart: bulkCartSchema,
  details: wholesaleCheckoutSchema,
});

export type PlaceWholesaleOrderInput = z.input<typeof placeSchema>;
export type PlaceWholesaleOrderResult = ActionResult<{ orderNumber: string }> & { refreshCart?: boolean };

/**
 * Place a wholesale order from the bulk cart. Everything is re-priced on the server for this
 * business; credit orders lock the credit row so concurrent orders can't exceed the limit.
 */
export async function placeWholesaleOrder(input: PlaceWholesaleOrderInput): Promise<PlaceWholesaleOrderResult> {
  return businessAction<{ orderNumber: string }>({ approved: true }, async (b) => {
    const parsed = placeSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[i.path.filter((p) => p !== "details").join(".")] ??= i.message;
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
    }
    const { idempotencyKey, cart, details } = parsed.data;
    const refresh = (error: string) => ({ ok: false as const, error, refreshCart: true });

    const existing = await db.order.findUnique({ where: { idempotencyKey }, select: { orderNumber: true, businessId: true } });
    if (existing) {
      if (existing.businessId !== b.id) return { ok: false, error: "Please refresh the page and try again." };
      return { ok: true, data: { orderNumber: existing.orderNumber } };
    }
    if (!(await rateLimit(`b2b-order:${b.id}`, 10, 10 * 60))) return { ok: false, error: "Too many orders in a short time. Please wait a few minutes." };
    if (cart.lines.length === 0) return { ok: false, error: "Your cart is empty." };
    if (cart.fulfilment !== details.fulfilment || (details.fulfilment === "DELIVERY" && cart.addressId !== details.addressId))
      return refresh("Please review your delivery choice again.");

    try {
      const order = await db.$transaction(
        async (tx) => {
          const scheduled = parseScheduleDate(details.scheduledDate);
          const priced = await priceBulkCart(b, { ...cart, addressId: details.addressId }, tx);
          const blocking = priced.lines.find((l) => !l.available || l.problem);
          if (blocking) throw new WholesaleOrderError(blocking.problem ?? "Some items are unavailable. Please update your cart.", true);
          if (priced.lines.some((l) => l.priceChanged)) throw new WholesaleOrderError("Some prices have changed. Please review your cart.", true);
          if (!priced.canOrder) throw new WholesaleOrderError(priced.problems[0] ?? "This order can't be placed right now.");

          return createWholesaleOrder(tx, {
            business: b,
            idempotencyKey,
            fulfilment: details.fulfilment,
            addressId: details.fulfilment === "DELIVERY" ? details.addressId : null,
            zoneId: priced.zone?.id ?? null,
            placeOfSupply: priced.placeOfSupply,
            lines: priced.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.name, size: l.size, hsnCode: l.hsnCode, gstRateBps: l.gstRateBps, unitPrice: l.unitPrice, quantity: l.quantity })),
            totals: priced.totals,
            paymentMethod: details.paymentMethod,
            scheduledDate: scheduled,
            slot: details.slot,
            poNumber: details.poNumber,
            poDate: details.poDate,
            notes: details.notes,
            historyNote: `Wholesale order placed by ${b.contactName}`,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
      );
      revalidatePath("/admin", "layout");
      revalidatePath("/business", "layout");
      return { ok: true, data: { orderNumber: order.orderNumber } };
    } catch (e) {
      if (e instanceof WholesaleOrderError) return e.refreshCart ? refresh(e.message) : { ok: false, error: e.message };
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await db.order.findUnique({ where: { idempotencyKey }, select: { orderNumber: true, businessId: true } });
        if (dup && dup.businessId === b.id) return { ok: true, data: { orderNumber: dup.orderNumber } };
      }
      throw e;
    }
  });
}

/** Lines of a past order, re-priced for today, to load into the bulk cart ("repeat order"). */
export async function reorderLines(orderNumber: string) {
  return businessAction<{ lines: BulkLine[]; skipped: number }>({ approved: true }, async (b) => {
    const order = await db.order.findFirst({
      where: { orderNumber, businessId: b.id },
      select: { fulfilment: true, businessAddressId: true, items: { select: { variantId: true, quantity: true } } },
    });
    if (!order) return { ok: false, error: "Order not found" };
    const wanted = order.items.filter((i): i is { variantId: string; quantity: number } => !!i.variantId);
    const priced = await priceBulkCart(b, { lines: wanted, fulfilment: order.fulfilment, addressId: order.businessAddressId ?? "" });
    const lines: BulkLine[] = priced.lines
      .filter((l) => l.available)
      .map((l) => ({
        variantId: l.variantId,
        productId: l.productId,
        slug: l.slug,
        name: l.name,
        image: l.image,
        size: l.size,
        volumeMl: l.volumeMl,
        packSize: l.packSize,
        moq: l.moq,
        packaging: l.packaging,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      }));
    return { ok: true, data: { lines, skipped: order.items.length - lines.length } };
  });
}

/** The business confirms it received a dispatched order (delivery confirmation). */
export async function confirmDeliveryReceived(orderNumber: string, receivedBy: string) {
  return businessAction({}, async (b) => {
    const name = receivedBy.trim().slice(0, 60);
    if (name.length < 2) return { ok: false, error: "Enter the name of the person who received the goods." };
    const order = await db.order.findFirst({
      where: { orderNumber, businessId: b.id },
      select: { id: true, status: true, delivery: { select: { id: true, confirmedByBusinessAt: true } } },
    });
    if (!order?.delivery) return { ok: false, error: "Order not found" };
    if (!["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED"].includes(order.status))
      return { ok: false, error: "You can confirm receipt once the order has been dispatched." };
    if (order.delivery.confirmedByBusinessAt) return { ok: false, error: "Already confirmed" };
    await db.delivery.update({ where: { id: order.delivery.id }, data: { confirmedByBusinessAt: new Date(), receivedBy: name } });
    await audit({ businessId: b.id }, { action: "delivery.confirm", entityType: "Order", entityId: order.id, summary: `Receipt of ${orderNumber} confirmed by ${name}` });
    revalidatePath("/business", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Thanks – receipt confirmed." };
  });
}
