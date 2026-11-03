import { describe, expect, it } from "vitest";
import {
  allocate,
  calculateWholesaleTotals,
  quantityProblem,
  resolveUnitPrice,
  tierFor,
  wholesaleDeliveryFee,
} from "@/lib/wholesale-pricing";
import { amountInWords, financialYear, formatInvoiceNumber, gstinChecksum, gstinProblem, isValidGstin, taxForAmount } from "@/lib/gst";
import { creditDecision, dueDateFor } from "@/lib/credit";
import { allowedTransitions, canTransition, nextStatus, timelineSteps } from "@/lib/order-status";
import { normalizeQuantity } from "@/lib/bulk-cart-store";

// A GSTIN with a correct checksum, built from a PAN-like body.
const body = "27AAPFU0939F1Z";
const GSTIN = body + gstinChecksum(body);

describe("GSTIN", () => {
  it("accepts a GSTIN with a valid checksum", () => {
    expect(isValidGstin(GSTIN)).toBe(true);
    expect(isValidGstin(GSTIN.toLowerCase())).toBe(true);
  });
  it("rejects a wrong checksum, bad state code and bad shape", () => {
    const wrong = body + (GSTIN[14] === "A" ? "B" : "A");
    expect(gstinProblem(wrong)).toMatch(/doesn't look right/);
    expect(gstinProblem("99AAPFU0939F1Z5")).toMatch(/state code/);
    expect(gstinProblem("27AAPFU0939F")).toMatch(/15 characters/);
  });
  it("matches a known real-format GSTIN checksum", () => {
    // 27AAPFU0939F1ZV is the sample GSTIN used in GST portal documentation.
    expect(gstinChecksum("27AAPFU0939F1Z")).toBe("V");
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });
});

describe("GST split", () => {
  it("splits intra-state tax into equal CGST and SGST", () => {
    expect(taxForAmount(10000, 500, false)).toEqual({ cgst: 250, sgst: 250, igst: 0, tax: 500 });
    expect(taxForAmount(10001, 1800, false)).toEqual({ cgst: 900, sgst: 900, igst: 0, tax: 1800 });
  });
  it("charges IGST for inter-state supply", () => {
    expect(taxForAmount(10000, 1200, true)).toEqual({ cgst: 0, sgst: 0, igst: 1200, tax: 1200 });
  });
  it("rejects floats and bad rates", () => {
    expect(() => taxForAmount(10.5, 500, false)).toThrow();
    expect(() => taxForAmount(100, 20000, false)).toThrow();
  });
});

describe("invoice numbering", () => {
  it("uses the Indian financial year in IST", () => {
    expect(financialYear(new Date("2026-11-03T10:00:00Z"))).toBe("26-27");
    expect(financialYear(new Date("2027-03-31T18:00:00Z"))).toBe("26-27"); // 31 Mar 23:30 IST
    expect(financialYear(new Date("2027-03-31T18:31:00Z"))).toBe("27-28"); // 1 Apr 00:01 IST
    expect(formatInvoiceNumber("26-27", 12)).toBe("CK/26-27/00012");
  });
  it("writes amounts in words, Indian style", () => {
    expect(amountInWords(12345678)).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only");
    expect(amountInWords(100)).toBe("Rupees One Only");
  });
});

describe("wholesale unit price", () => {
  const tiers = [
    { minQuantity: 48, discountBps: 300 },
    { minQuantity: 120, discountBps: 600 },
  ];
  it("uses the base price with no price list", () => {
    expect(resolveUnitPrice({ basePrice: 5000, quantity: 24 })).toMatchObject({ unitPrice: 5000, source: "base" });
  });
  it("applies the price-list discount, then the best volume tier", () => {
    const r = resolveUnitPrice({ basePrice: 5000, priceList: { discountBps: 1000 }, tiers, quantity: 120 });
    expect(r).toMatchObject({ listPrice: 4500, unitPrice: 4230, source: "priceList", tierDiscountBps: 600 });
  });
  it("prefers a price-list item override over the % discount", () => {
    expect(resolveUnitPrice({ basePrice: 5000, priceList: { discountBps: 1000, itemPrice: 4000 }, quantity: 1 })?.unitPrice).toBe(4000);
  });
  it("uses the customer price as final (no tier on top)", () => {
    expect(resolveUnitPrice({ basePrice: 5000, customerPrice: 3900, tiers, quantity: 500 })).toMatchObject({ unitPrice: 3900, source: "customer", tierDiscountBps: 0 });
  });
  it("returns null when the variant has no wholesale price", () => {
    expect(resolveUnitPrice({ basePrice: null, quantity: 10 })).toBeNull();
  });
  it("picks the largest reached tier", () => {
    expect(tierFor(tiers, 47)).toBeNull();
    expect(tierFor(tiers, 48)?.discountBps).toBe(300);
    expect(tierFor(tiers, 1000)?.discountBps).toBe(600);
  });
});

describe("MOQ and packs", () => {
  it("checks minimum quantity and pack multiples", () => {
    expect(quantityProblem(12, 24, 12)).toMatch(/Minimum/);
    expect(quantityProblem(30, 24, 12)).toMatch(/packs of 12/);
    expect(quantityProblem(36, 24, 12)).toBeNull();
  });
  it("rounds cart quantities up to whole packs and the MOQ", () => {
    expect(normalizeQuantity(1, 12, 24)).toBe(24);
    expect(normalizeQuantity(25, 12, 24)).toBe(36);
    expect(normalizeQuantity(7, 1, 1)).toBe(7);
  });
});

describe("wholesale totals", () => {
  it("adds GST per line and on delivery at the highest rate", () => {
    const t = calculateWholesaleTotals({
      lines: [
        { unitPrice: 4000, quantity: 24, gstRateBps: 1200 }, // 96,000
        { unitPrice: 2000, quantity: 10, gstRateBps: 500 }, // 20,000
      ],
      deliveryFee: 10000,
      interState: false,
    });
    expect(t.subtotal).toBe(116000);
    expect(t.taxableValue).toBe(126000);
    // 96000×12% = 11520, 20000×5% = 1000, delivery 10000×12% = 1200
    expect(t.taxTotal).toBe(11520 + 1000 + 1200);
    expect(t.cgst).toBe(t.sgst);
    expect(t.igst).toBe(0);
    expect(t.total).toBe(126000 + 13720);
  });
  it("uses IGST for other states", () => {
    const t = calculateWholesaleTotals({ lines: [{ unitPrice: 1000, quantity: 10, gstRateBps: 500 }], interState: true });
    expect(t).toMatchObject({ cgst: 0, sgst: 0, igst: 500, total: 10500 });
  });
  it("spreads an order discount across lines before tax, exactly", () => {
    const t = calculateWholesaleTotals({
      lines: [
        { unitPrice: 333, quantity: 3, gstRateBps: 1800 },
        { unitPrice: 1000, quantity: 1, gstRateBps: 0 },
      ],
      discount: 100,
      interState: false,
    });
    expect(t.lines.reduce((s, l) => s + l.discountShare, 0)).toBe(100);
    expect(t.subtotal - t.discount).toBe(t.lines.reduce((s, l) => s + l.taxable, 0));
    expect(t.total).toBe(t.taxableValue + t.taxTotal);
  });
  it("reports the minimum-order shortfall on the item value", () => {
    expect(calculateWholesaleTotals({ lines: [{ unitPrice: 1000, quantity: 5, gstRateBps: 500 }], interState: false, minOrder: 10000 }).minOrderShortfall).toBe(5000);
  });
  it("allocates with the largest-remainder method", () => {
    expect(allocate(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
  });
  it("applies free delivery above the zone threshold", () => {
    expect(wholesaleDeliveryFee({ deliveryFee: 5000, freeDeliveryAbove: 100000 }, 100000)).toBe(0);
    expect(wholesaleDeliveryFee({ deliveryFee: 5000, freeDeliveryAbove: 100000 }, 99999)).toBe(5000);
    expect(wholesaleDeliveryFee(null, 1)).toBe(0);
  });
});

describe("credit", () => {
  it("blocks orders when credit is off or the limit would be exceeded", () => {
    expect(creditDecision({ isActive: false, limit: 100000, outstanding: 0 }, 1000).ok).toBe(false);
    expect(creditDecision({ isActive: true, limit: 100000, outstanding: 60000 }, 40000).ok).toBe(true);
    const blocked = creditDecision({ isActive: true, limit: 100000, outstanding: 60000 }, 40001);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toContain("₹400");
  });
  it("computes due dates from credit days", () => {
    expect(dueDateFor(new Date("2026-11-01T00:00:00Z"), 15).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
});

describe("wholesale order statuses", () => {
  it("adds a PACKED step for wholesale orders only", () => {
    expect(allowedTransitions("PREPARING", "DELIVERY", "WHOLESALE")).toEqual(["PACKED", "CANCELLED"]);
    expect(allowedTransitions("PACKED", "DELIVERY", "WHOLESALE")).toEqual(["OUT_FOR_DELIVERY", "CANCELLED"]);
    expect(allowedTransitions("PACKED", "PICKUP", "WHOLESALE")).toEqual(["READY_FOR_PICKUP", "CANCELLED"]);
    expect(canTransition("PREPARING", "OUT_FOR_DELIVERY", "DELIVERY", "WHOLESALE")).toBe(false);
    expect(allowedTransitions("PACKED", "DELIVERY")).toEqual([]);
  });
  it("keeps retail transitions unchanged", () => {
    expect(nextStatus("PREPARING", "DELIVERY")).toBe("OUT_FOR_DELIVERY");
    expect(timelineSteps("PICKUP")).toHaveLength(5);
    expect(timelineSteps("PICKUP", "WHOLESALE")).toHaveLength(6);
  });
});
