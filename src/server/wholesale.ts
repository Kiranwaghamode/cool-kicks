import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { GST_STATES, stateName } from "@/lib/gst";
import { formatPaise } from "@/lib/money";
import {
  calculateWholesaleTotals,
  quantityProblem,
  resolveUnitPrice,
  wholesaleDeliveryFee,
  type Tier,
  type WholesaleTotals,
} from "@/lib/wholesale-pricing";
import type { bulkCartSchema } from "@/lib/b2b-validation";
import type { Fulfilment, Size } from "@/lib/types";
import type { z } from "zod";

type Tx = Prisma.TransactionClient | typeof db;

/** The parts of a business needed for pricing. */
export type PricingCustomer = { id: string; groupId: string | null; stateCode: string };

/** Price list + negotiated prices that apply to one business. */
export async function getPricingContext(customer: PricingCustomer, tx: Tx = db) {
  const now = new Date();
  const [group, customerPrices] = await Promise.all([
    customer.groupId
      ? tx.customerGroup.findFirst({
          where: { id: customer.groupId, isActive: true },
          select: { priceList: { select: { isActive: true, discountBps: true, items: { select: { variantId: true, price: true } } } } },
        })
      : null,
    tx.customerPrice.findMany({
      where: { businessId: customer.id, OR: [{ validTo: null }, { validTo: { gte: now } }] },
      select: { variantId: true, price: true },
    }),
  ]);
  const list = group?.priceList?.isActive ? group.priceList : null;
  return {
    priceList: list ? { discountBps: list.discountBps, items: new Map(list.items.map((i) => [i.variantId, i.price])) } : null,
    customerPrices: new Map(customerPrices.map((p) => [p.variantId, p.price])),
  };
}

export type PricingContext = Awaited<ReturnType<typeof getPricingContext>>;

export function priceFor(ctx: PricingContext, v: { id: string; wholesalePrice: number | null; tiers: Tier[] }, quantity: number) {
  return resolveUnitPrice({
    basePrice: v.wholesalePrice,
    priceList: ctx.priceList ? { discountBps: ctx.priceList.discountBps, itemPrice: ctx.priceList.items.get(v.id) ?? null } : null,
    customerPrice: ctx.customerPrices.get(v.id) ?? null,
    tiers: v.tiers,
    quantity,
  });
}

/** Finished stock per variant: remaining units in batches that haven't expired. */
export async function finishedStock(variantIds: string[], tx: Tx = db) {
  if (!variantIds.length) return new Map<string, number>();
  const rows = await tx.batch.groupBy({
    by: ["variantId"],
    where: { variantId: { in: variantIds }, quantityRemaining: { gt: 0 }, expiresAt: { gt: new Date() } },
    _sum: { quantityRemaining: true },
  });
  return new Map(rows.map((r) => [r.variantId, r._sum.quantityRemaining ?? 0]));
}

const wholesaleVariantWhere = {
  wholesaleEnabled: true,
  wholesalePrice: { not: null },
} satisfies Prisma.ProductVariantWhereInput;

// ───────────────────────── Catalogue ─────────────────────────

export async function getWholesaleCatalogue(customer: PricingCustomer) {
  const [ctx, products] = await Promise.all([
    getPricingContext(customer),
    db.product.findMany({
      where: { isActive: true, category: { isActive: true }, variants: { some: wholesaleVariantWhere } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        image: true,
        isAvailable: true,
        gstRateBps: true,
        hsnCode: true,
        category: { select: { name: true, slug: true } },
        variants: {
          where: wholesaleVariantWhere,
          orderBy: { volumeMl: "asc" },
          select: { id: true, size: true, volumeMl: true, isAvailable: true, wholesalePrice: true, moq: true, packSize: true, packaging: true, tiers: { orderBy: { minQuantity: "asc" } } },
        },
      },
    }),
  ]);
  const stock = await finishedStock(products.flatMap((p) => p.variants.map((v) => v.id)));

  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    image: p.image,
    categoryName: p.category.name,
    categorySlug: p.category.slug,
    gstRateBps: p.gstRateBps,
    hsnCode: p.hsnCode,
    variants: p.variants.map((v) => {
      const atMoq = priceFor(ctx, v, Math.max(v.moq, v.packSize));
      return {
        id: v.id,
        size: v.size as Size,
        volumeMl: v.volumeMl,
        moq: v.moq,
        packSize: v.packSize,
        packaging: v.packaging,
        available: p.isAvailable && v.isAvailable && !!atMoq,
        listPrice: atMoq?.listPrice ?? 0,
        unitPrice: atMoq?.unitPrice ?? 0,
        special: atMoq?.source === "customer",
        tiers:
          atMoq?.source === "customer"
            ? []
            : v.tiers.map((t) => ({ minQuantity: t.minQuantity, discountBps: t.discountBps, unitPrice: priceFor(ctx, v, t.minQuantity)?.unitPrice ?? 0 })),
        stock: stock.get(v.id) ?? 0,
      };
    }),
  }));
}

export type WholesaleProduct = Awaited<ReturnType<typeof getWholesaleCatalogue>>[number];

// ───────────────────────── Bulk cart pricing ─────────────────────────

type ParsedBulkCart = z.output<typeof bulkCartSchema>;

export type PricedBulkLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: Size;
  volumeMl: number;
  moq: number;
  packSize: number;
  packaging: string | null;
  hsnCode: string | null;
  gstRateBps: number;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  tierDiscountBps: number;
  special: boolean;
  lineTotal: number;
  tax: number;
  available: boolean;
  priceChanged: boolean;
  problem: string | null;
  stock: number;
};

export type PricedBulkCart = {
  lines: PricedBulkLine[];
  problems: string[];
  fulfilment: Fulfilment;
  address: { id: string; label: string; text: string; pincode: string; stateCode: string } | null;
  zone: { id: string; name: string; deliveryFee: number; freeDeliveryAbove: number | null } | null;
  deliverable: boolean | null;
  placeOfSupply: string;
  interState: boolean;
  totals: WholesaleTotals;
  minOrder: number;
  canOrder: boolean;
};

export function stateCodeFor(name: string, fallback: string) {
  return GST_STATES.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())?.code ?? fallback;
}

/**
 * Re-price a bulk cart for one business from the database. Browser prices are ignored except
 * to flag changes. `opts.ignoreMinimum` is used for quotation requests.
 */
export async function priceBulkCart(customer: PricingCustomer, input: ParsedBulkCart, tx: Tx = db, opts: { ignoreMinimum?: boolean } = {}): Promise<PricedBulkCart> {
  const settings = await tx.shopSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: { stateCode: true, wholesaleEnabled: true, wholesaleMinOrder: true, pickupEnabled: true, deliveryEnabled: true },
  });
  const problems: string[] = [];
  if (!settings.wholesaleEnabled) problems.push("Wholesale ordering is paused right now. Please contact us.");

  // Merge duplicate lines defensively.
  const qty = new Map<string, { quantity: number; unitPrice?: number }>();
  for (const l of input.lines) {
    const prev = qty.get(l.variantId);
    qty.set(l.variantId, { quantity: (prev?.quantity ?? 0) + l.quantity, unitPrice: l.unitPrice });
  }

  const [ctx, variants] = await Promise.all([
    getPricingContext(customer, tx),
    tx.productVariant.findMany({
      where: { id: { in: [...qty.keys()] } },
      select: {
        id: true,
        size: true,
        volumeMl: true,
        isAvailable: true,
        wholesaleEnabled: true,
        wholesalePrice: true,
        moq: true,
        packSize: true,
        packaging: true,
        tiers: true,
        product: { select: { id: true, slug: true, name: true, image: true, isActive: true, isAvailable: true, gstRateBps: true, hsnCode: true, category: { select: { isActive: true } } } },
      },
    }),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const stock = await finishedStock([...qty.keys()], tx);

  const lines: PricedBulkLine[] = [];
  for (const [variantId, l] of qty) {
    const v = byId.get(variantId);
    if (!v) {
      problems.push("An item in your cart is no longer sold wholesale.");
      continue;
    }
    const p = v.product;
    const price = priceFor(ctx, v, l.quantity);
    const available = p.isActive && p.isAvailable && p.category.isActive && v.isAvailable && v.wholesaleEnabled && !!price;
    const qtyProblem = available ? quantityProblem(l.quantity, v.moq, v.packSize) : null;
    const unitPrice = price?.unitPrice ?? 0;
    const priceChanged = available && l.unitPrice !== undefined && l.unitPrice !== unitPrice;
    const problem = !available ? `${p.name} (${v.size.toLowerCase()}) is unavailable right now.` : qtyProblem ? `${p.name}: ${qtyProblem}.` : null;
    if (problem) problems.push(problem);
    else if (priceChanged) problems.push(`${p.name} is now ${formatPaise(unitPrice)} per unit (price updated).`);
    lines.push({
      variantId,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.image,
      size: v.size as Size,
      volumeMl: v.volumeMl,
      moq: v.moq,
      packSize: v.packSize,
      packaging: v.packaging,
      hsnCode: p.hsnCode,
      gstRateBps: p.gstRateBps,
      quantity: l.quantity,
      unitPrice,
      listPrice: price?.listPrice ?? 0,
      tierDiscountBps: price?.tierDiscountBps ?? 0,
      special: price?.source === "customer",
      lineTotal: available ? unitPrice * l.quantity : 0,
      tax: 0,
      available,
      priceChanged,
      problem,
      stock: stock.get(variantId) ?? 0,
    });
  }

  // Address, zone and place of supply.
  const fulfilment = input.fulfilment;
  let address: PricedBulkCart["address"] = null;
  let zone: PricedBulkCart["zone"] = null;
  let deliverable: boolean | null = null;
  if (fulfilment === "DELIVERY") {
    if (!settings.deliveryEnabled) problems.push("Delivery is not available right now – choose pickup or request a quotation.");
    if (input.addressId) {
      const a = await tx.businessAddress.findFirst({ where: { id: input.addressId, businessId: customer.id, isActive: true } });
      if (a) {
        address = {
          id: a.id,
          label: a.label,
          text: [a.line1, a.line2, a.landmark, a.area, a.city, a.state, a.pincode].filter(Boolean).join(", "),
          pincode: a.pincode,
          stateCode: stateCodeFor(a.state, customer.stateCode),
        };
        zone = await tx.deliveryZone.findFirst({
          where: { isActive: true, pincodes: { has: a.pincode } },
          select: { id: true, name: true, deliveryFee: true, freeDeliveryAbove: true },
        });
        deliverable = !!zone;
        if (!zone) problems.push(`We don't deliver to ${a.pincode} yet. Choose pickup, or request a quotation and we'll arrange delivery.`);
      }
    }
  } else if (!settings.pickupEnabled) problems.push("Pickup is not available right now.");

  // GST place of supply: where goods are delivered; for pickup, the buyer's registered state.
  const placeOfSupply = address?.stateCode ?? customer.stateCode;
  const interState = placeOfSupply !== settings.stateCode;

  const okLines = lines.filter((l) => l.available);
  const itemsValue = okLines.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryFee = fulfilment === "DELIVERY" ? wholesaleDeliveryFee(zone, itemsValue) : 0;
  const totals = calculateWholesaleTotals({
    lines: okLines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity, gstRateBps: l.gstRateBps })),
    deliveryFee,
    interState,
    minOrder: opts.ignoreMinimum ? 0 : settings.wholesaleMinOrder,
  });
  okLines.forEach((l, i) => (l.tax = totals.lines[i].tax));
  if (totals.minOrderShortfall > 0 && okLines.length)
    problems.push(`The wholesale minimum is ${formatPaise(settings.wholesaleMinOrder)} before GST. Add ${formatPaise(totals.minOrderShortfall)} more.`);

  const canOrder =
    settings.wholesaleEnabled &&
    okLines.length > 0 &&
    lines.every((l) => l.available && !l.problem) &&
    totals.minOrderShortfall === 0 &&
    (fulfilment === "PICKUP" ? settings.pickupEnabled : settings.deliveryEnabled && deliverable === true);

  return {
    lines,
    problems: [...new Set(problems)],
    fulfilment,
    address,
    zone,
    deliverable,
    placeOfSupply,
    interState,
    totals,
    minOrder: settings.wholesaleMinOrder,
    canOrder,
  };
}

export function placeOfSupplyLabel(code: string) {
  return `${stateName(code)} (${code})`;
}
