import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { creditDecision } from "@/lib/credit";
import { addDays, parseISTDate, startOfDayIST } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import type { WholesaleTotals } from "@/lib/wholesale-pricing";
import type { DeliverySlot, Fulfilment, Size, WholesalePaymentMethod } from "@/lib/types";
import { getCreditSummary, lockCreditAccount } from "@/server/credit";
import { audit } from "@/server/audit";

export const MAX_SCHEDULE_DAYS = 30;

export class WholesaleOrderError extends Error {
  constructor(
    message: string,
    public refreshCart = false,
  ) {
    super(message);
  }
}

/** Requested delivery / pickup date: tomorrow (IST) up to 30 days ahead. */
export function parseScheduleDate(key: string) {
  const d = parseISTDate(key);
  const earliest = addDays(startOfDayIST(), 1);
  if (!d || d < earliest || d > addDays(earliest, MAX_SCHEDULE_DAYS - 1))
    throw new WholesaleOrderError(`Choose a date between tomorrow and ${MAX_SCHEDULE_DAYS} days from now.`);
  return d;
}

export type WholesaleOrderLine = {
  productId: string;
  variantId: string;
  name: string;
  size: Size;
  hsnCode: string | null;
  gstRateBps: number;
  unitPrice: number;
  quantity: number;
};

/**
 * Create a wholesale order inside a transaction (from the bulk cart or an accepted quotation).
 * Checks payment-method availability and the credit limit (with a row lock) before writing.
 */
export async function createWholesaleOrder(
  tx: Prisma.TransactionClient,
  args: {
    business: { id: string; displayName: string; contactName: string; phone: string };
    idempotencyKey: string;
    fulfilment: Fulfilment;
    addressId: string | null;
    zoneId: string | null;
    placeOfSupply: string;
    lines: WholesaleOrderLine[];
    totals: WholesaleTotals;
    paymentMethod: WholesalePaymentMethod;
    scheduledDate: Date;
    slot: DeliverySlot;
    poNumber: string;
    poDate: string;
    notes: string;
    historyNote: string;
  },
) {
  const { business: b, totals: t } = args;
  const s = await tx.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { codEnabled: true, payAtShopEnabled: true, wholesaleEnabled: true } });
  if (!s.wholesaleEnabled) throw new WholesaleOrderError("Wholesale ordering is paused right now. Please contact us.");
  if (args.paymentMethod === "CASH_ON_DELIVERY" && (args.fulfilment !== "DELIVERY" || !s.codEnabled)) throw new WholesaleOrderError("Cash on delivery isn't available for this order.");
  if (args.paymentMethod === "PAY_AT_SHOP" && (args.fulfilment !== "PICKUP" || !s.payAtShopEnabled)) throw new WholesaleOrderError("Pay at shop isn't available for this order.");

  if (args.paymentMethod === "CREDIT") {
    await lockCreditAccount(tx, b.id);
    const decision = creditDecision(await getCreditSummary(b.id, tx), t.total);
    if (!decision.ok) throw new WholesaleOrderError(decision.reason);
  }

  const [full, address] = await Promise.all([
    tx.business.findUniqueOrThrow({ where: { id: b.id }, select: { email: true } }),
    args.fulfilment === "DELIVERY" && args.addressId ? tx.businessAddress.findFirst({ where: { id: args.addressId, businessId: b.id, isActive: true } }) : null,
  ]);
  if (args.fulfilment === "DELIVERY" && !address) throw new WholesaleOrderError("That delivery address is no longer available. Please choose another.", true);

  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  const orderNumber = `CK-${row.n.toString()}`;

  const created = await tx.order.create({
    data: {
      orderNumber,
      idempotencyKey: args.idempotencyKey,
      channel: "WHOLESALE",
      businessId: b.id,
      customerName: b.displayName,
      customerPhone: address?.phone ?? b.phone,
      customerEmail: full.email,
      fulfilment: args.fulfilment,
      businessAddressId: address?.id ?? null,
      addressLine1: address?.line1 ?? null,
      addressLine2: address?.line2 ?? null,
      landmark: address?.landmark ?? null,
      area: address?.area ?? null,
      city: address?.city ?? null,
      state: address?.state ?? null,
      pincode: address?.pincode ?? null,
      deliveryZoneId: args.zoneId,
      subtotal: t.subtotal,
      discount: t.discount,
      deliveryFee: t.deliveryFee,
      cgst: t.cgst,
      sgst: t.sgst,
      igst: t.igst,
      taxTotal: t.taxTotal,
      total: t.total,
      placeOfSupply: args.placeOfSupply,
      paymentMethod: args.paymentMethod,
      paymentStatus: "PENDING",
      poNumber: args.poNumber || null,
      poDate: args.poDate ? parseISTDate(args.poDate) : null,
      notes: args.notes || null,
      status: "PLACED",
      items: {
        create: args.lines.map((l, i) => ({
          productId: l.productId,
          variantId: l.variantId,
          productName: l.name,
          size: l.size,
          hsnCode: l.hsnCode,
          gstRateBps: l.gstRateBps,
          taxAmount: t.lines[i].tax,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineTotal: t.lines[i].lineTotal,
        })),
      },
      history: { create: { fromStatus: null, toStatus: "PLACED", note: args.historyNote } },
      delivery: { create: { scheduledDate: args.scheduledDate, slot: args.slot } },
    },
    select: { id: true, orderNumber: true },
  });
  await audit(
    { businessId: b.id },
    { action: "order.place", entityType: "Order", entityId: created.id, summary: `Placed ${orderNumber} for ${formatPaise(t.total)}${args.poNumber ? ` (PO ${args.poNumber})` : ""}` },
    tx,
  );
  return created;
}
