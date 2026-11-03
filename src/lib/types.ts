// Client-safe string unions mirroring the Prisma enums (keeps Prisma out of client bundles).

export const SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type Size = (typeof SIZES)[number];

export const LEVELS = ["NONE", "LESS", "REGULAR", "EXTRA"] as const;
export type Level = (typeof LEVELS)[number];

export type Fulfilment = "PICKUP" | "DELIVERY";
export type PaymentMethod = "CASH_ON_DELIVERY" | "PAY_AT_SHOP" | "ONLINE" | "BANK_TRANSFER" | "CREDIT";
export type PaymentStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "FAILED" | "REFUNDED";
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
  BANK_TRANSFER: "Bank transfer / UPI (advance)",
  CREDIT: "On credit",
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Payment pending",
  PARTIALLY_PAID: "Partly paid",
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

// ───────────────────────── Wholesale (B2B) ─────────────────────────

export type OrderChannel = "RETAIL" | "WHOLESALE";
export const BUSINESS_TYPES = ["RETAILER", "DISTRIBUTOR"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type BusinessStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export const DOCUMENT_TYPES = ["GST_CERTIFICATE", "PAN", "TRADE_LICENSE", "FSSAI", "OTHER"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type QuotationStatus = "REQUESTED" | "QUOTED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
export const PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentKind = "PAYMENT" | "REFUND";
export const DELIVERY_SLOTS = ["MORNING", "AFTERNOON", "EVENING"] as const;
export type DeliverySlot = (typeof DELIVERY_SLOTS)[number];
export type DeliveryStatus = "SCHEDULED" | "DISPATCHED" | "DELIVERED" | "FAILED";
export type InvoiceStatus = "ISSUED" | "CANCELLED";
export type BatchReason = "PRODUCTION" | "SALE" | "RETURN" | "WASTAGE" | "ADJUSTMENT";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = { RETAILER: "Retailer", DISTRIBUTOR: "Distributor" };
export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  PENDING: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  GST_CERTIFICATE: "GST certificate",
  PAN: "PAN card",
  TRADE_LICENSE: "Trade / shop licence",
  FSSAI: "FSSAI licence",
  OTHER: "Other document",
};
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = { PENDING: "Not reviewed", VERIFIED: "Verified", REJECTED: "Rejected" };
export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  REQUESTED: "Requested",
  QUOTED: "Quote sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
};
export const DELIVERY_SLOT_LABELS: Record<DeliverySlot, string> = {
  MORNING: "Morning (8–12)",
  AFTERNOON: "Afternoon (12–4)",
  EVENING: "Evening (4–8)",
};
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  SCHEDULED: "Scheduled",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};
export const BATCH_REASON_LABELS: Record<BatchReason, string> = {
  PRODUCTION: "Produced",
  SALE: "Wholesale order",
  RETURN: "Returned",
  WASTAGE: "Wastage / expired",
  ADJUSTMENT: "Adjustment",
};
/** Wholesale payment methods a business can choose at checkout. */
export const WHOLESALE_PAYMENT_METHODS = ["CREDIT", "BANK_TRANSFER", "CASH_ON_DELIVERY", "PAY_AT_SHOP"] as const;
export type WholesalePaymentMethod = (typeof WHOLESALE_PAYMENT_METHODS)[number];
