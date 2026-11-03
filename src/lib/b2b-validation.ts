import { z } from "zod";
import { indianMobile, pincode } from "@/lib/validation";
import { gstinProblem, isValidPan, isValidStateCode, normalizeGstin } from "@/lib/gst";
import { BUSINESS_TYPES, DELIVERY_SLOTS, WHOLESALE_PAYMENT_METHODS } from "@/lib/types";

// Shared Zod schemas for the wholesale (B2B) portal – used by forms and re-checked on the server.

export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(100, "That's too long")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and at least one number");

const optionalGstin = z
  .string()
  .trim()
  .transform(normalizeGstin)
  .superRefine((g, ctx) => {
    if (!g) return;
    const problem = gstinProblem(g);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

const optionalPan = z
  .string()
  .trim()
  .toUpperCase()
  .refine((p) => !p || isValidPan(p), "PAN should look like ABCDE1234F");

export const stateCode = z.string().refine(isValidStateCode, "Choose a state");

export const addressSchema = z.object({
  label: z.string().trim().min(2, "Name this address, e.g. Main shop").max(40),
  contactName: z.string().trim().min(2, "Who receives deliveries here?").max(60),
  phone: indianMobile,
  line1: z.string().trim().min(3, "Enter the shop / building and street").max(120),
  line2: z.string().trim().max(120).optional().default(""),
  landmark: z.string().trim().max(80).optional().default(""),
  area: z.string().trim().min(2, "Enter the area").max(80),
  city: z.string().trim().min(2, "Enter the city").max(60),
  stateCode,
  pincode,
});
export type AddressForm = z.input<typeof addressSchema>;

export const registerBusinessSchema = z
  .object({
    legalName: z.string().trim().min(2, "Enter the registered business name").max(120),
    tradeName: z.string().trim().max(120).optional().default(""),
    type: z.enum(BUSINESS_TYPES, { message: "Choose retailer or distributor" }),
    contactName: z.string().trim().min(2, "Enter the contact person's name").max(60),
    phone: indianMobile,
    email: z.union([z.string().trim().toLowerCase().email("Enter a valid email"), z.literal("")]).optional().default(""),
    password,
    gstin: optionalGstin.optional().default(""),
    pan: optionalPan.optional().default(""),
    stateCode,
    address: addressSchema.omit({ label: true, contactName: true, phone: true, stateCode: true }),
    acceptTerms: z.literal(true, { message: "Please accept the terms to continue" }),
  })
  .superRefine((v, ctx) => {
    if (v.gstin && v.gstin.slice(0, 2) !== v.stateCode)
      ctx.addIssue({ code: "custom", path: ["stateCode"], message: "State must match your GSTIN (first two digits)" });
    if (v.gstin && v.pan && v.gstin.slice(2, 12) !== v.pan)
      ctx.addIssue({ code: "custom", path: ["pan"], message: "PAN doesn't match the one inside your GSTIN" });
  });
export type RegisterBusinessForm = z.input<typeof registerBusinessSchema>;

export const businessLoginSchema = z.object({
  phone: indianMobile,
  password: z.string().min(1, "Enter your password").max(200),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password").max(200),
    next: password,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

// ───────────────────────── Wholesale cart & checkout ─────────────────────────

export const MAX_WHOLESALE_QTY = 100_000;

export const bulkLineSchema = z.object({
  variantId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(MAX_WHOLESALE_QTY),
  /** Display price the browser saw – only used to detect price changes. */
  unitPrice: z.number().int().nonnegative().optional(),
});

export const bulkCartSchema = z.object({
  lines: z.array(bulkLineSchema).max(60, "Please split very large orders or request a quotation."),
  fulfilment: z.enum(["PICKUP", "DELIVERY"]),
  addressId: z.string().max(40).optional().default(""),
});
export type BulkCartInput = z.input<typeof bulkCartSchema>;

export const wholesaleCheckoutSchema = z
  .object({
    fulfilment: z.enum(["PICKUP", "DELIVERY"]),
    addressId: z.string().max(40).optional().default(""),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery date"),
    slot: z.enum(DELIVERY_SLOTS),
    paymentMethod: z.enum(WHOLESALE_PAYMENT_METHODS),
    poNumber: z.string().trim().max(40).regex(/^[A-Za-z0-9/_.-]*$/, "Letters, numbers and / - _ . only").optional().default(""),
    poDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment === "DELIVERY" && !v.addressId)
      ctx.addIssue({ code: "custom", path: ["addressId"], message: "Choose a delivery address" });
    if (v.fulfilment === "DELIVERY" && v.paymentMethod === "PAY_AT_SHOP")
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Pay at shop is for pickup orders" });
    if (v.fulfilment === "PICKUP" && v.paymentMethod === "CASH_ON_DELIVERY")
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Cash on delivery is for delivery orders" });
  });
export type WholesaleCheckoutForm = z.input<typeof wholesaleCheckoutSchema>;
