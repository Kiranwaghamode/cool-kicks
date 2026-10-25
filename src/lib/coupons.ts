import { formatPaise } from "@/lib/money";
import type { CouponType } from "@/lib/types";

type CouponLike = {
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
};

/** Big headline for a coupon: "10% OFF", "₹30 OFF", "Buy 2 Get 1 Free" */
export function couponHeadline(c: CouponLike) {
  if (c.type === "PERCENT") return `${c.value}% OFF`;
  if (c.type === "FLAT") return `${formatPaise(c.value)} OFF`;
  return `Buy ${c.buyQuantity ?? 2} Get ${c.getQuantity ?? 1} Free`;
}

/** Conditions line: "On orders above ₹200 · up to ₹50 off" */
export function couponConditions(c: CouponLike) {
  const parts: string[] = [];
  if (c.minOrderAmount > 0) parts.push(`On orders above ${formatPaise(c.minOrderAmount)}`);
  if (c.type === "PERCENT" && c.maxDiscount) parts.push(`up to ${formatPaise(c.maxDiscount)} off`);
  if (c.type === "BUY_X_GET_Y") parts.push("Cheapest item free");
  return parts.join(" · ") || "No minimum order";
}
