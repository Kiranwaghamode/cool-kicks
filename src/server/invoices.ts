import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { dueDateFor } from "@/lib/credit";
import { financialYear, formatInvoiceNumber, stateName } from "@/lib/gst";
import { calculateWholesaleTotals } from "@/lib/wholesale-pricing";
import { audit } from "@/server/audit";

type Tx = Prisma.TransactionClient;

/** Everything printed on a GST invoice, frozen at the moment it is issued. */
export type InvoiceSnapshot = {
  number: string;
  issuedAt: string;
  dueDate: string;
  orderNumber: string;
  poNumber: string | null;
  poDate: string | null;
  paymentMethod: string;
  seller: { name: string; gstin: string | null; address: string; stateCode: string; state: string; phone: string; email: string | null; bankDetails: string | null; terms: string | null };
  buyer: { name: string; tradeName: string | null; gstin: string | null; stateCode: string; state: string; address: string; phone: string };
  shipTo: string | null;
  placeOfSupply: string;
  interState: boolean;
  lines: {
    name: string;
    size: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    discount: number;
    taxable: number;
    gstRateBps: number;
    cgst: number;
    sgst: number;
    igst: number;
  }[];
  totals: { subtotal: number; discount: number; deliveryFee: number; deliveryTax: number; taxableValue: number; cgst: number; sgst: number; igst: number; taxTotal: number; total: number };
};

/**
 * Issue the GST invoice for a wholesale order (idempotent – returns the existing one).
 * Numbers are sequential per financial year: CK/26-27/00001.
 */
export async function issueInvoice(tx: Tx, orderId: string, staffId: string | null) {
  const existing = await tx.invoice.findUnique({ where: { orderId }, select: { id: true, number: true } });
  if (existing) return existing;

  const [o, s] = await Promise.all([
    tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: "asc" } },
        business: { include: { credit: true, addresses: { where: { isDefault: true, isActive: true }, take: 1 } } },
      },
    }),
    tx.shopSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (o.channel !== "WHOLESALE" || !o.business) throw new Error("Invoices are only issued for wholesale orders");
  if (o.status === "CANCELLED" || o.status === "REJECTED") throw new Error("Can't invoice a cancelled order");

  const interState = (o.placeOfSupply ?? s.stateCode) !== s.stateCode;
  const t = calculateWholesaleTotals({
    lines: o.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, gstRateBps: i.gstRateBps })),
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    interState,
  });
  // The order was priced by the same module; if it ever disagrees, trust the order totals.
  if (t.total !== o.total) console.warn(`[invoice] recomputed total ${t.total} differs from order ${o.orderNumber} total ${o.total}`);

  const fy = financialYear(new Date());
  const [counter] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceCounter" ("fy", "last") VALUES (${fy}, 1)
    ON CONFLICT ("fy") DO UPDATE SET "last" = "InvoiceCounter"."last" + 1
    RETURNING "last"`;
  const number = formatInvoiceNumber(fy, counter.last);
  const issuedAt = new Date();
  const dueDate = o.paymentMethod === "CREDIT" ? dueDateFor(issuedAt, o.business.credit?.creditDays ?? s.defaultCreditDays) : issuedAt;

  const b = o.business;
  const billing = b.addresses[0];
  const shipTo = o.fulfilment === "DELIVERY" ? [o.addressLine1, o.addressLine2, o.landmark, o.area, o.city, o.state, o.pincode].filter(Boolean).join(", ") : null;
  const snapshot: InvoiceSnapshot = {
    number,
    issuedAt: issuedAt.toISOString(),
    dueDate: dueDate.toISOString(),
    orderNumber: o.orderNumber,
    poNumber: o.poNumber,
    poDate: o.poDate?.toISOString() ?? null,
    paymentMethod: o.paymentMethod,
    seller: {
      name: s.legalName || s.shopName,
      gstin: s.gstin,
      address: s.address,
      stateCode: s.stateCode,
      state: stateName(s.stateCode),
      phone: s.phone,
      email: s.email,
      bankDetails: s.bankDetails,
      terms: s.invoiceTerms,
    },
    buyer: {
      name: b.legalName,
      tradeName: b.tradeName,
      gstin: b.gstin,
      stateCode: b.stateCode,
      state: stateName(b.stateCode),
      address: billing ? [billing.line1, billing.line2, billing.area, billing.city, billing.state, billing.pincode].filter(Boolean).join(", ") : (shipTo ?? ""),
      phone: b.phone,
    },
    shipTo,
    placeOfSupply: o.placeOfSupply ?? b.stateCode,
    interState,
    lines: o.items.map((i, k) => ({
      name: i.productName,
      size: i.size,
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      discount: t.lines[k].discountShare,
      taxable: t.lines[k].taxable,
      gstRateBps: i.gstRateBps,
      cgst: t.lines[k].cgst,
      sgst: t.lines[k].sgst,
      igst: t.lines[k].igst,
    })),
    totals: {
      subtotal: o.subtotal,
      discount: o.discount,
      deliveryFee: o.deliveryFee,
      deliveryTax: t.deliveryTax,
      taxableValue: o.subtotal - o.discount + o.deliveryFee,
      cgst: o.cgst,
      sgst: o.sgst,
      igst: o.igst,
      taxTotal: o.taxTotal,
      total: o.total,
    },
  };

  const inv = await tx.invoice.create({
    data: { number, orderId, businessId: b.id, issuedAt, dueDate, snapshot: snapshot as unknown as Prisma.InputJsonValue, total: o.total, createdById: staffId },
    select: { id: true, number: true },
  });
  await audit(staffId ? { staffId } : "system", { action: "invoice.issue", entityType: "Invoice", entityId: inv.id, summary: `Issued invoice ${number} for ${o.orderNumber}` }, tx);
  return inv;
}

/** Cancel the invoice of a cancelled order (GST invoices are never deleted). */
export async function cancelInvoiceForOrder(tx: Tx, orderId: string, reason: string, staffId: string | null) {
  const inv = await tx.invoice.findUnique({ where: { orderId }, select: { id: true, number: true, status: true } });
  if (!inv || inv.status === "CANCELLED") return;
  await tx.invoice.update({ where: { id: inv.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 300) } });
  await audit(staffId ? { staffId } : "system", { action: "invoice.cancel", entityType: "Invoice", entityId: inv.id, summary: `Cancelled invoice ${inv.number}: ${reason}` }, tx);
}
