import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, nextStatus } from "@/lib/order-status";
import { indianMobile, orderNumber } from "@/lib/validation";
import { formatPaise, rupeesToPaise } from "@/lib/money";

describe("order status transitions", () => {
  it("follows the pickup path", () => {
    expect(nextStatus("PLACED", "PICKUP")).toBe("CONFIRMED");
    expect(nextStatus("CONFIRMED", "PICKUP")).toBe("PREPARING");
    expect(nextStatus("PREPARING", "PICKUP")).toBe("READY_FOR_PICKUP");
    expect(nextStatus("READY_FOR_PICKUP", "PICKUP")).toBe("DELIVERED");
    expect(nextStatus("DELIVERED", "PICKUP")).toBeNull();
  });

  it("follows the delivery path", () => {
    expect(nextStatus("PREPARING", "DELIVERY")).toBe("OUT_FOR_DELIVERY");
    expect(canTransition("PREPARING", "READY_FOR_PICKUP", "DELIVERY")).toBe(false);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY")).toBe(true);
  });

  it("only allows rejecting new orders", () => {
    expect(canTransition("PLACED", "REJECTED", "PICKUP")).toBe(true);
    expect(canTransition("CONFIRMED", "REJECTED", "PICKUP")).toBe(false);
  });

  it("allows cancelling any time before delivery, never after", () => {
    for (const s of ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"] as const) {
      expect(canTransition(s, "CANCELLED", "PICKUP")).toBe(true);
    }
    expect(allowedTransitions("DELIVERED", "PICKUP")).toEqual([]);
    expect(allowedTransitions("CANCELLED", "PICKUP")).toEqual([]);
    expect(allowedTransitions("REJECTED", "DELIVERY")).toEqual([]);
  });

  it("blocks skipping steps", () => {
    expect(canTransition("PLACED", "PREPARING", "PICKUP")).toBe(false);
    expect(canTransition("PLACED", "DELIVERED", "DELIVERY")).toBe(false);
  });
});

describe("validation helpers", () => {
  it("normalises Indian mobile numbers", () => {
    expect(indianMobile.parse("+91 98765 43210")).toBe("9876543210");
    expect(indianMobile.parse("09876543210")).toBe("9876543210");
    expect(indianMobile.safeParse("12345").success).toBe(false);
    expect(indianMobile.safeParse("5876543210").success).toBe(false);
  });

  it("validates order numbers", () => {
    expect(orderNumber.parse("ck-20431")).toBe("CK-20431");
    expect(orderNumber.safeParse("IJ-20431").success).toBe(false);
  });

  it("formats paise as rupees", () => {
    expect(formatPaise(8000)).toBe("₹80");
    expect(formatPaise(8050)).toBe("₹80.50");
    expect(rupeesToPaise("80.5")).toBe(8050);
    expect(() => formatPaise(80.5)).toThrow();
  });
});
