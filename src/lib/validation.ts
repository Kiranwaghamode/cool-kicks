import { z } from "zod";
import { LEVELS, SIZES } from "@/lib/types";

// Shared Zod schemas – used by client forms and re-checked on the server.

export const indianMobile = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const pincode = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode");

export const orderNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^CK-\d{4,8}$/, "Order numbers look like CK-20431");

export const couponCode = z
  .string()
  .trim()
  .toUpperCase()
  .max(30)
  .regex(/^[A-Z0-9_-]*$/, "Coupon codes contain only letters and numbers");

export const cartLineSchema = z.object({
  key: z.string().max(400),
  productId: z.string().min(1).max(40),
  size: z.enum(SIZES),
  sugar: z.enum(LEVELS),
  ice: z.enum(LEVELS),
  instructions: z.string().trim().max(200).default(""),
  quantity: z.number().int().min(1).max(20),
  /** Display price the browser saw – only used to detect price changes. */
  unitPrice: z.number().int().nonnegative().optional(),
});

export const cartInputSchema = z.object({
  lines: z.array(cartLineSchema).max(30, "That's a lot of drinks! Please call us for bulk orders."),
  couponCode: couponCode.optional().default(""),
  fulfilment: z.enum(["PICKUP", "DELIVERY"]),
  pincode: z.union([pincode, z.literal("")]).optional().default(""),
});

export type CartInput = z.input<typeof cartInputSchema>;

export const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Please enter your name").max(60),
    customerPhone: indianMobile,
    customerEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
    fulfilment: z.enum(["PICKUP", "DELIVERY"]),
    addressLine1: z.string().trim().max(120).optional().default(""),
    addressLine2: z.string().trim().max(120).optional().default(""),
    landmark: z.string().trim().max(80).optional().default(""),
    area: z.string().trim().max(80).optional().default(""),
    pincode: z.string().trim().optional().default(""),
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "PAY_AT_SHOP"]),
    notes: z.string().trim().max(300).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "DELIVERY") {
      if (v.addressLine1.length < 3)
        ctx.addIssue({ code: "custom", path: ["addressLine1"], message: "Please enter your house / flat and street" });
      if (v.area.length < 2) ctx.addIssue({ code: "custom", path: ["area"], message: "Please enter your area" });
      if (!/^[1-9]\d{5}$/.test(v.pincode))
        ctx.addIssue({ code: "custom", path: ["pincode"], message: "Enter a valid 6-digit pincode" });
      if (v.paymentMethod !== "CASH_ON_DELIVERY")
        ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Delivery orders are Cash on Delivery" });
    } else if (v.paymentMethod !== "PAY_AT_SHOP") {
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Pickup orders are paid at the shop" });
    }
  });

export type CheckoutForm = z.input<typeof checkoutSchema>;

export const trackSchema = z.object({ orderNumber, phone: indianMobile });
