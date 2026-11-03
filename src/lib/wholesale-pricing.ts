/**
 * Wholesale (B2B) pricing – the ONE place wholesale prices and GST totals are calculated.
 * Pure, integer paise, no database access. Used by the catalogue, bulk cart, checkout,
 * quotations and invoices (always re-run on the server).
 *
 * Unit price for a business, in priority order:
 *   1. Customer-specific price (negotiated)            → final, no volume discount on top
 *   2. Price-list item override for the business's group
 *   3. Base wholesale price − price-list % discount
 *   then (2/3 only) the best volume tier for the quantity: − tier %.
 *
 * Totals (all excl. GST until the last step):
 *   subtotal − discount + deliveryFee = taxable value;  + GST = total
 * GST is per line on the line's share of the discount; the delivery fee is taxed at the highest
 * rate in the order (composite supply follows the principal supply).
 */

import { taxForAmount } from "@/lib/gst";

export type Tier = { minQuantity: number; discountBps: number };

export type PriceInputs = {
  /** Base wholesale price (paise excl. GST). null = not sold wholesale. */
  basePrice: number | null;
  priceList?: { discountBps: number; itemPrice?: number | null } | null;
  customerPrice?: number | null;
  tiers?: Tier[];
  quantity: number;
};

export type ResolvedPrice = {
  unitPrice: number;
  /** Price before the volume discount (what the price list / base gives). */
  listPrice: number;
  source: "customer" | "priceList" | "base";
  tierDiscountBps: number;
};

const applyBps = (amount: number, bps: number) => Math.round((amount * (10000 - Math.min(Math.max(bps, 0), 10000))) / 10000);

/** Best (largest) discount whose minimum quantity is reached. */
export function tierFor(tiers: Tier[] | undefined, quantity: number): Tier | null {
  let best: Tier | null = null;
  for (const t of tiers ?? []) if (quantity >= t.minQuantity && (!best || t.discountBps > best.discountBps)) best = t;
  return best;
}

export function resolveUnitPrice(input: PriceInputs): ResolvedPrice | null {
  if (input.customerPrice != null && input.customerPrice > 0) {
    return { unitPrice: input.customerPrice, listPrice: input.customerPrice, source: "customer", tierDiscountBps: 0 };
  }
  let listPrice: number;
  let source: ResolvedPrice["source"] = "base";
  if (input.priceList?.itemPrice != null && input.priceList.itemPrice > 0) {
    listPrice = input.priceList.itemPrice;
    source = "priceList";
  } else {
    if (input.basePrice == null || input.basePrice <= 0) return null;
    listPrice = input.priceList ? applyBps(input.basePrice, input.priceList.discountBps) : input.basePrice;
    if (input.priceList && input.priceList.discountBps > 0) source = "priceList";
  }
  const tier = tierFor(input.tiers, input.quantity);
  return { unitPrice: tier ? applyBps(listPrice, tier.discountBps) : listPrice, listPrice, source, tierDiscountBps: tier?.discountBps ?? 0 };
}

/** Quantity rules: at least the MOQ and a whole number of packs. Returns a message or null. */
export function quantityProblem(quantity: number, moq: number, packSize: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return "Enter a quantity";
  if (quantity < moq) return `Minimum order is ${moq} units`;
  if (packSize > 1 && quantity % packSize !== 0) return `Order in packs of ${packSize}`;
  return null;
}

// ───────────────────────── Totals with GST ─────────────────────────

export type WholesaleLineInput = { unitPrice: number; quantity: number; gstRateBps: number };

export type WholesaleLineTotals = WholesaleLineInput & {
  lineTotal: number;
  /** Share of the order-level discount. */
  discountShare: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
};

export type WholesaleTotals = {
  lines: WholesaleLineTotals[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  deliveryTax: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  total: number;
  unitCount: number;
  /** Paise of taxable value still needed for the wholesale minimum (0 when met). */
  minOrderShortfall: number;
};

function assertPaise(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer, got ${n}`);
}

/** Split `amount` across `weights` proportionally; shares are integers that add up exactly. */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const shares = raw.map(Math.floor);
  let rest = amount - shares.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    shares[i] += 1;
    rest -= 1;
  }
  return shares;
}

export function calculateWholesaleTotals(input: {
  lines: WholesaleLineInput[];
  discount?: number;
  deliveryFee?: number;
  interState: boolean;
  minOrder?: number;
}): WholesaleTotals {
  const deliveryFee = input.deliveryFee ?? 0;
  assertPaise(deliveryFee, "deliveryFee");
  for (const l of input.lines) {
    assertPaise(l.unitPrice, "unitPrice");
    assertPaise(l.quantity, "quantity");
    if (!Number.isInteger(l.gstRateBps) || l.gstRateBps < 0 || l.gstRateBps > 10000) throw new Error(`invalid GST rate ${l.gstRateBps}`);
  }
  const lineTotals = input.lines.map((l) => l.unitPrice * l.quantity);
  const subtotal = lineTotals.reduce((s, x) => s + x, 0);
  const discount = Math.min(Math.max(input.discount ?? 0, 0), subtotal);
  assertPaise(discount, "discount");
  const shares = allocate(discount, lineTotals);

  const lines: WholesaleLineTotals[] = input.lines.map((l, i) => {
    const taxable = lineTotals[i] - shares[i];
    return { ...l, lineTotal: lineTotals[i], discountShare: shares[i], taxable, ...taxForAmount(taxable, l.gstRateBps, input.interState) };
  });

  const maxRate = input.lines.reduce((m, l) => Math.max(m, l.gstRateBps), 0);
  const dTax = taxForAmount(deliveryFee, maxRate, input.interState);

  const cgst = lines.reduce((s, l) => s + l.cgst, 0) + dTax.cgst;
  const sgst = lines.reduce((s, l) => s + l.sgst, 0) + dTax.sgst;
  const igst = lines.reduce((s, l) => s + l.igst, 0) + dTax.igst;
  const taxTotal = cgst + sgst + igst;
  const itemsTaxable = subtotal - discount;
  const taxableValue = itemsTaxable + deliveryFee;

  return {
    lines,
    subtotal,
    discount,
    deliveryFee,
    deliveryTax: dTax.tax,
    taxableValue,
    cgst,
    sgst,
    igst,
    taxTotal,
    total: taxableValue + taxTotal,
    unitCount: input.lines.reduce((s, l) => s + l.quantity, 0),
    minOrderShortfall: Math.max(0, (input.minOrder ?? 0) - itemsTaxable),
  };
}

/** Delivery fee for a wholesale order from the zone (free above the threshold, on item value after discount). */
export function wholesaleDeliveryFee(zone: { deliveryFee: number; freeDeliveryAbove: number | null } | null, itemsTaxable: number) {
  if (!zone) return 0;
  if (zone.freeDeliveryAbove !== null && itemsTaxable >= zone.freeDeliveryAbove) return 0;
  return zone.deliveryFee;
}
