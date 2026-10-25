import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { calculateOrderTotals, type OrderTotals, type PricingCoupon } from "@/lib/pricing";
import { formatPaise } from "@/lib/money";
import { getShopStatus, type ShopStatus } from "@/lib/shop-hours";
import type { cartInputSchema } from "@/lib/validation";
import type { z } from "zod";
import type { Fulfilment, Level, Size } from "@/lib/types";
import { lineKey } from "@/lib/cart-line";

type Tx = Prisma.TransactionClient | typeof db;
type ParsedCart = z.output<typeof cartInputSchema>;

export type PricedLine = {
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
  lineTotal: number;
  available: boolean;
  priceChanged: boolean;
};

export type CartProblem = { key?: string; message: string };

export type PricedCart = {
  lines: PricedLine[];
  problems: CartProblem[];
  coupon: { code: string; applied: boolean; message: string | null } | null;
  zone: { id: string; name: string; deliveryFee: number; freeDeliveryAbove: number | null } | null;
  /** For DELIVERY: true/false once a pincode is known, null when no pincode given. */
  deliverable: boolean | null;
  totals: OrderTotals;
  shop: {
    status: ShopStatus;
    minOrderAmount: number;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
    codEnabled: boolean;
    payAtShopEnabled: boolean;
  };
  /** True when nothing blocks placing this order (shop open, items available, minimum met, zone ok). */
  canOrder: boolean;
};

/** Find a usable coupon or explain why it can't be used. */
export async function findCoupon(code: string, tx: Tx = db): Promise<{ coupon: PricingCoupon & { id: string } | null; error: string | null }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { coupon: null, error: null };
  const c = await tx.coupon.findUnique({ where: { code: normalized } });
  const now = new Date();
  if (!c || !c.isActive) return { coupon: null, error: `“${normalized}” isn't a valid coupon` };
  if (c.validFrom > now) return { coupon: null, error: `${normalized} isn't active yet` };
  if (c.validTo < now) return { coupon: null, error: `${normalized} has expired` };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit)
    return { coupon: null, error: `${normalized} has reached its usage limit` };
  return {
    coupon: {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderAmount: c.minOrderAmount,
      maxDiscount: c.maxDiscount,
      buyQuantity: c.buyQuantity,
      getQuantity: c.getQuantity,
    },
    error: null,
  };
}

export async function findZoneByPincode(pin: string, tx: Tx = db) {
  if (!pin) return null;
  return tx.deliveryZone.findFirst({
    where: { isActive: true, pincodes: { has: pin } },
    select: { id: true, name: true, deliveryFee: true, freeDeliveryAbove: true },
  });
}

/**
 * Re-price a cart from the database. This is the only source of truth for money –
 * browser prices are ignored except to tell the customer a price changed.
 */
export async function priceCart(input: ParsedCart, tx: Tx = db): Promise<PricedCart> {
  const settings = await tx.shopSettings.findUniqueOrThrow({ where: { id: 1 } });
  const status = getShopStatus(settings);
  const problems: CartProblem[] = [];

  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true, category: { select: { isActive: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Merge duplicate lines (same options) defensively.
  const merged = new Map<string, ParsedCart["lines"][number]>();
  for (const l of input.lines) {
    const p = byId.get(l.productId);
    const sugar = p && !p.allowSugarChoice ? "REGULAR" : l.sugar;
    const ice = p && !p.allowIceChoice ? "REGULAR" : l.ice;
    const key = lineKey({ productId: l.productId, size: l.size, sugar, ice, instructions: l.instructions });
    const prev = merged.get(key);
    merged.set(key, { ...l, sugar, ice, key, quantity: Math.min(20, (prev?.quantity ?? 0) + l.quantity) });
  }

  const lines: PricedLine[] = [];
  for (const l of merged.values()) {
    const p = byId.get(l.productId);
    const v = p?.variants.find((x) => x.size === l.size);
    const available = !!p && p.isActive && p.isAvailable && p.category.isActive && !!v && v.isAvailable;
    const unitPrice = v?.price ?? 0;
    const priceChanged = available && l.unitPrice !== undefined && l.unitPrice !== unitPrice;
    if (!p) problems.push({ key: l.key, message: "An item in your cart is no longer on the menu." });
    else if (!available) problems.push({ key: l.key, message: `${p.name} is unavailable right now.` });
    else if (priceChanged)
      problems.push({ key: l.key, message: `${p.name} is now ${formatPaise(unitPrice)} (price updated).` });
    lines.push({
      key: l.key,
      productId: l.productId,
      slug: p?.slug ?? "",
      name: p?.name ?? "Unavailable item",
      image: p?.image ?? null,
      size: l.size,
      sugar: l.sugar,
      ice: l.ice,
      instructions: l.instructions,
      quantity: l.quantity,
      unitPrice,
      lineTotal: available ? unitPrice * l.quantity : 0,
      available,
      priceChanged,
    });
  }

  const fulfilment: Fulfilment = input.fulfilment;
  if (fulfilment === "PICKUP" && !settings.pickupEnabled)
    problems.push({ message: "Pickup is not available right now." });
  if (fulfilment === "DELIVERY" && !settings.deliveryEnabled)
    problems.push({ message: "Home delivery is not available right now." });

  let zone: PricedCart["zone"] = null;
  let deliverable: boolean | null = null;
  if (fulfilment === "DELIVERY" && input.pincode) {
    zone = await findZoneByPincode(input.pincode, tx);
    deliverable = !!zone;
    if (!zone) problems.push({ message: `Sorry, we don't deliver to ${input.pincode} yet.` });
  }

  let coupon: PricedCart["coupon"] = null;
  let pricingCoupon: PricingCoupon | null = null;
  if (input.couponCode) {
    const found = await findCoupon(input.couponCode, tx);
    pricingCoupon = found.coupon;
    if (found.error) coupon = { code: input.couponCode, applied: false, message: found.error };
  }

  const availableLines = lines.filter((l) => l.available);
  const totals = calculateOrderTotals({
    items: availableLines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    coupon: pricingCoupon,
    fulfilment,
    deliveryZone: zone,
    settings: { minOrderAmount: settings.minOrderAmount },
  });
  if (pricingCoupon) {
    coupon = { code: pricingCoupon.code, applied: totals.couponApplied, message: totals.couponMessage };
  }

  const canOrder =
    status.isOpen &&
    availableLines.length > 0 &&
    availableLines.length === lines.length &&
    totals.meetsMinimum &&
    (fulfilment === "PICKUP" ? settings.pickupEnabled : settings.deliveryEnabled && deliverable === true);

  return {
    lines,
    problems,
    coupon,
    zone,
    deliverable,
    totals,
    shop: {
      status,
      minOrderAmount: settings.minOrderAmount,
      pickupEnabled: settings.pickupEnabled,
      deliveryEnabled: settings.deliveryEnabled,
      codEnabled: settings.codEnabled,
      payAtShopEnabled: settings.payAtShopEnabled,
    },
    canOrder,
  };
}
