// Client-safe string unions mirroring the Prisma enums (keeps Prisma out of client bundles).

export const SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type Size = (typeof SIZES)[number];

export const LEVELS = ["NONE", "LESS", "REGULAR", "EXTRA"] as const;
export type Level = (typeof LEVELS)[number];

export type Fulfilment = "PICKUP" | "DELIVERY";
export type PaymentMethod = "CASH_ON_DELIVERY" | "PAY_AT_SHOP" | "ONLINE";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type CouponType = "PERCENT" | "FLAT" | "BUY_X_GET_Y";
export type ProductTag = "BESTSELLER" | "NEW" | "SEASONAL";
export type Role = "OWNER" | "MANAGER" | "STAFF";

export const SIZE_LABELS: Record<Size, string> = { SMALL: "Small", MEDIUM: "Medium", LARGE: "Large" };
export const SUGAR_LABELS: Record<Level, string> = {
  NONE: "No sugar",
  LESS: "Less sugar",
  REGULAR: "Regular sugar",
  EXTRA: "Extra sugar",
};
export const ICE_LABELS: Record<Level, string> = {
  NONE: "No ice",
  LESS: "Less ice",
  REGULAR: "Regular ice",
  EXTRA: "Extra ice",
};
export const TAG_LABELS: Record<ProductTag, string> = {
  BESTSELLER: "Bestseller",
  NEW: "New",
  SEASONAL: "Seasonal",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  PAY_AT_SHOP: "Pay at Shop",
  ONLINE: "Online",
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};
export const FULFILMENT_LABELS: Record<Fulfilment, string> = {
  PICKUP: "Pickup",
  DELIVERY: "Home delivery",
};

/** Product data shown on cards across the site (serialisable). */
export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  tags: ProductTag[];
  isAvailable: boolean;
  categoryName: string;
  /** Lowest available variant price (paise). */
  fromPrice: number;
  /** Default (Medium, or first available) variant for one-tap add. */
  defaultSize: Size | null;
  defaultPrice: number | null;
  rating: number | null;
  reviewCount: number;
};
