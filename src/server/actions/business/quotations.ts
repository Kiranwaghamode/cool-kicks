"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { bulkCartSchema, wholesaleCheckoutBase } from "@/lib/b2b-validation";
import { calculateWholesaleTotals } from "@/lib/wholesale-pricing";
import { businessAction } from "@/server/business-auth";
import { priceBulkCart } from "@/server/wholesale";
import { createWholesaleOrder, parseScheduleDate, WholesaleOrderError } from "@/server/wholesale-orders";
import { isQuoteExpired, recalcQuotation } from "@/server/quotations";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";

function refresh() {
  revalidatePath("/business", "layout");
  revalidatePath("/admin", "layout");
}

const requestSchema = bulkCartSchema.extend({ note: z.string().trim().max(1000).optional().default("") });

/**
 * Request a quotation (RFQ) for the items in the bulk cart. Items start at the business's
 * current price so staff have a starting point. MOQ / minimum order are not enforced here.
 */
export async function requestQuotation(input: z.input<typeof requestSchema>) {
  return businessAction<{ number: string }>({ approved: true }, async (b) => {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your cart." };
    if (parsed.data.lines.length === 0) return { ok: false, error: "Add products to your cart first." };
    if (!(await rateLimit(`b2b-rfq:${b.id}`, 10, 60 * 60))) return { ok: false, error: "Too many requests. Please try again later." };

    const priced = await priceBulkCart(b, parsed.data, db, { ignoreMinimum: true });
    const lines = priced.lines.filter((l) => l.available);
    if (!lines.length) return { ok: false, error: "None of these products are available right now." };

    const q = await db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('quotation_number_seq') AS n`;
      const number = `QT-${row.n.toString()}`;
      const created = await tx.quotation.create({
        data: {
          number,
          businessId: b.id,
          status: "REQUESTED",
          requestNote: parsed.data.note || null,
          fulfilment: priced.fulfilment,
          addressId: priced.address?.id ?? null,
          pincode: priced.address?.pincode ?? null,
          placeOfSupply: priced.placeOfSupply,
          // Delivery fee: the zone fee when the address is in a zone; staff can change it.
          deliveryFee: priced.totals.deliveryFee,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              productName: l.name,
              size: l.size,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              hsnCode: l.hsnCode,
              gstRateBps: l.gstRateBps,
              lineTotal: l.lineTotal,
            })),
          },
        },
        select: { id: true, number: true },
      });
      await recalcQuotation(tx, created.id);
      await audit({ businessId: b.id }, { action: "quotation.request", entityType: "Quotation", entityId: created.id, summary: `Requested quotation ${number}` }, tx);
      return created;
    });
    refresh();
    return { ok: true, data: { number: q.number } };
  });
}

const acceptSchema = z.object({
  number: z.string().regex(/^QT-\d+$/),
  idempotencyKey: z.string().uuid("Please refresh the page and try again."),
  details: wholesaleCheckoutBase.omit({ fulfilment: true, addressId: true }),
});

/** Accept a sent quotation: it becomes an order at the quoted prices. */
export async function acceptQuotation(input: z.input<typeof acceptSchema>) {
  return businessAction<{ orderNumber: string }>({ approved: true }, async (b) => {
    const parsed = acceptSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[i.path.filter((p) => p !== "details").join(".")] ??= i.message;
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
    }
    const { number, idempotencyKey, details } = parsed.data;
    try {
      const order = await db.$transaction(
        async (tx) => {
          const q = await tx.quotation.findFirst({ where: { number, businessId: b.id }, include: { items: { orderBy: { id: "asc" } } } });
          if (!q) throw new WholesaleOrderError("Quotation not found");
          if (q.status !== "QUOTED") throw new WholesaleOrderError("This quotation can't be accepted any more.");
          if (isQuoteExpired(q)) throw new WholesaleOrderError("This quotation has expired. Please request a new one.");
          if (q.fulfilment === "DELIVERY" && details.paymentMethod === "PAY_AT_SHOP") throw new WholesaleOrderError("Pay at shop is for pickup orders.");
          if (q.fulfilment === "PICKUP" && details.paymentMethod === "CASH_ON_DELIVERY") throw new WholesaleOrderError("Cash on delivery is for delivery orders.");

          // Claim the quote first so it can only turn into one order.
          const claimed = await tx.quotation.updateMany({ where: { id: q.id, status: "QUOTED" }, data: { status: "ACCEPTED", respondedAt: new Date() } });
          if (claimed.count === 0) throw new WholesaleOrderError("This quotation was just updated. Please refresh.");

          const settings = await tx.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { stateCode: true } });
          const totals = calculateWholesaleTotals({
            lines: q.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, gstRateBps: i.gstRateBps })),
            discount: q.discount,
            deliveryFee: q.fulfilment === "DELIVERY" ? q.deliveryFee : 0,
            interState: q.placeOfSupply !== settings.stateCode,
          });
          const zone = q.pincode ? await tx.deliveryZone.findFirst({ where: { isActive: true, pincodes: { has: q.pincode } }, select: { id: true } }) : null;
          const created = await createWholesaleOrder(tx, {
            business: b,
            idempotencyKey,
            fulfilment: q.fulfilment,
            addressId: q.addressId,
            zoneId: zone?.id ?? null,
            placeOfSupply: q.placeOfSupply,
            lines: q.items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.productName, size: i.size, hsnCode: i.hsnCode, gstRateBps: i.gstRateBps, unitPrice: i.unitPrice, quantity: i.quantity })),
            totals,
            paymentMethod: details.paymentMethod,
            scheduledDate: parseScheduleDate(details.scheduledDate),
            slot: details.slot,
            poNumber: details.poNumber,
            poDate: details.poDate,
            notes: details.notes,
            historyNote: `Placed from quotation ${q.number}`,
          });
          await tx.quotation.update({ where: { id: q.id }, data: { orderId: created.id } });
          await audit({ businessId: b.id }, { action: "quotation.accept", entityType: "Quotation", entityId: q.id, summary: `Accepted ${q.number} → order ${created.orderNumber}` }, tx);
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
      );
      refresh();
      return { ok: true, data: { orderNumber: order.orderNumber } };
    } catch (e) {
      if (e instanceof WholesaleOrderError) return { ok: false, error: e.message };
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const dup = await db.order.findUnique({ where: { idempotencyKey }, select: { orderNumber: true, businessId: true } });
        if (dup && dup.businessId === b.id) return { ok: true, data: { orderNumber: dup.orderNumber } };
      }
      throw e;
    }
  });
}

export async function declineQuotation(number: string, reason: string) {
  return businessAction({ approved: true }, async (b) => {
    const q = await db.quotation.findFirst({ where: { number, businessId: b.id }, select: { id: true, status: true } });
    if (!q) return { ok: false, error: "Quotation not found" };
    const updated = await db.quotation.updateMany({
      where: { id: q.id, status: { in: ["REQUESTED", "QUOTED"] } },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    if (updated.count === 0) return { ok: false, error: "This quotation can't be changed any more." };
    await audit({ businessId: b.id }, { action: "quotation.decline", entityType: "Quotation", entityId: q.id, summary: `Declined ${number}${reason.trim() ? ` – ${reason.trim().slice(0, 200)}` : ""}` });
    refresh();
    return { ok: true, message: q.status === "REQUESTED" ? "Request withdrawn" : "Quotation declined" };
  });
}
