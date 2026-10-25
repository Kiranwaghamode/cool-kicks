/**
 * The ONE pricing module. Used by the cart preview (via the validateCart server action)
 * and by placeOrder. All amounts are integer paise. Pure – no database access here.
 *
 *   total = subtotal − discount + deliveryFee
 */
import { formatPaise } from "@/lib/money";
import type { CouponType, Fulfilment } from "@/lib/types";

export type PricingItem = {
  /** Server-side unit price in paise. */
  unitPrice: number;
  quantity: number;
};

export type PricingCoupon = {
  code: string;
  type: CouponType;
  /** PERCENT: whole percent (10 = 10%). FLAT: paise. BUY_X_GET_Y: unused. */
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
};

export type PricingZone = { deliveryFee: number; freeDeliveryAbove: number | null };

export type PricingInput = {
  items: PricingItem[];
  coupon?: PricingCoupon | null;
  fulfilment: Fulfilment;
  /** Required for DELIVERY to charge a fee; null = pincode not known / not served yet. */
  deliveryZone?: PricingZone | null;
  settings: { minOrderAmount: number };
};

export type OrderTotals = {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  couponApplied: boolean;
  /** Why the coupon didn't apply (only when a coupon was given). */
  couponMessage: string | null;
  /** Paise still needed to reach the minimum order (0 when met). */
  minOrderShortfall: number;
  meetsMinimum: boolean;
  /** Paise still needed for free delivery (null when not applicable). */
  freeDeliveryShortfall: number | null;
};

function assertInt(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer, got ${n}`);
}

/** Discount for a coupon on these items. Returns 0 + a reason when it doesn't apply. */
export function calculateDiscount(
  items: PricingItem[],
  subtotal: number,
  coupon: PricingCoupon,
): { discount: number; message: string | null } {
  if (subtotal < coupon.minOrderAmount) {
    return {
      discount: 0,
      message: `Add ${formatPaise(coupon.minOrderAmount - subtotal)} more to use ${coupon.code}`,
    };
  }

  let discount = 0;
  switch (coupon.type) {
    case "PERCENT": {
      const pct = Math.min(Math.max(coupon.value, 0), 100);
      discount = Math.floor((subtotal * pct) / 100);
      break;
    }
    case "FLAT":
      discount = Math.max(coupon.value, 0);
      break;
    case "BUY_X_GET_Y": {
      const buy = coupon.buyQuantity ?? 0;
      const get = coupon.getQuantity ?? 0;
      if (buy < 1 || get < 1) return { discount: 0, message: `${coupon.code} is not set up correctly` };
      // Every group of (buy + get) units gets its `get` cheapest units free.
      const units = items.flatMap((i) => Array<number>(i.quantity).fill(i.unitPrice)).sort((a, b) => a - b);
      const groups = Math.floor(units.length / (buy + get));
      const freeUnits = groups * get;
      if (freeUnits === 0) {
        const need = buy + get - units.length;
        return {
          discount: 0,
          message: `Add ${need} more drink${need === 1 ? "" : "s"} to use ${coupon.code}`,
        };
      }
      discount = units.slice(0, freeUnits).reduce((s, p) => s + p, 0);
      break;
    }
  }

  if (coupon.maxDiscount !== null && coupon.maxDiscount >= 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { discount, message: null };
}

export function calculateOrderTotals(input: PricingInput): OrderTotals {
  const { items, coupon, fulfilment, deliveryZone, settings } = input;
  for (const i of items) {
    assertInt(i.unitPrice, "unitPrice");
    assertInt(i.quantity, "quantity");
  }
  assertInt(settings.minOrderAmount, "minOrderAmount");

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  let discount = 0;
  let couponMessage: string | null = null;
  if (coupon) {
    const r = calculateDiscount(items, subtotal, coupon);
    discount = r.discount;
    couponMessage = r.message;
  }

  const afterDiscount = subtotal - discount;

  let deliveryFee = 0;
  let freeDeliveryShortfall: number | null = null;
  if (fulfilment === "DELIVERY" && deliveryZone) {
    assertInt(deliveryZone.deliveryFee, "deliveryFee");
    const threshold = deliveryZone.freeDeliveryAbove;
    if (threshold !== null && afterDiscount >= threshold) {
      deliveryFee = 0;
      freeDeliveryShortfall = 0;
    } else {
      deliveryFee = deliveryZone.deliveryFee;
      freeDeliveryShortfall = threshold !== null ? threshold - afterDiscount : null;
    }
  }

  // Minimum order is checked on the item value after discount.
  const minOrderShortfall = Math.max(0, settings.minOrderAmount - afterDiscount);

  return {
    subtotal,
    discount,
    deliveryFee,
    total: afterDiscount + deliveryFee,
    itemCount,
    couponApplied: !!coupon && discount > 0,
    couponMessage,
    minOrderShortfall,
    meetsMinimum: items.length > 0 && minOrderShortfall === 0,
    freeDeliveryShortfall,
  };
}
