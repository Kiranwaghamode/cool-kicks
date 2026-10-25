import { describe, expect, it } from "vitest";
import { calculateDiscount, calculateOrderTotals, type PricingCoupon } from "@/lib/pricing";

const settings = { minOrderAmount: 0 };
const rs = (n: number) => n * 100;

const percent = (over: Partial<PricingCoupon> = {}): PricingCoupon => ({
  code: "JUICY10",
  type: "PERCENT",
  value: 10,
  minOrderAmount: rs(200),
  maxDiscount: rs(50),
  buyQuantity: null,
  getQuantity: null,
  ...over,
});
const flat = (over: Partial<PricingCoupon> = {}): PricingCoupon => ({
  code: "FLAT30",
  type: "FLAT",
  value: rs(30),
  minOrderAmount: rs(250),
  maxDiscount: null,
  buyQuantity: null,
  getQuantity: null,
  ...over,
});
const bogo = (over: Partial<PricingCoupon> = {}): PricingCoupon => ({
  code: "BUY2GET1",
  type: "BUY_X_GET_Y",
  value: 0,
  minOrderAmount: 0,
  maxDiscount: null,
  buyQuantity: 2,
  getQuantity: 1,
  ...over,
});

describe("calculateOrderTotals – basics", () => {
  it("sums line totals in paise", () => {
    const t = calculateOrderTotals({
      items: [
        { unitPrice: rs(80), quantity: 2 },
        { unitPrice: rs(45), quantity: 1 },
      ],
      fulfilment: "PICKUP",
      settings,
    });
    expect(t.subtotal).toBe(rs(205));
    expect(t.discount).toBe(0);
    expect(t.deliveryFee).toBe(0);
    expect(t.total).toBe(rs(205));
    expect(t.itemCount).toBe(3);
  });

  it("empty cart never meets minimum", () => {
    const t = calculateOrderTotals({ items: [], fulfilment: "PICKUP", settings });
    expect(t.total).toBe(0);
    expect(t.meetsMinimum).toBe(false);
  });

  it("rejects non-integer money", () => {
    expect(() =>
      calculateOrderTotals({ items: [{ unitPrice: 80.5, quantity: 1 }], fulfilment: "PICKUP", settings }),
    ).toThrow();
    expect(() =>
      calculateOrderTotals({ items: [{ unitPrice: 100, quantity: -1 }], fulfilment: "PICKUP", settings }),
    ).toThrow();
  });

  it("total = subtotal − discount + deliveryFee", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(100), quantity: 3 }],
      coupon: flat(),
      fulfilment: "DELIVERY",
      deliveryZone: { deliveryFee: rs(40), freeDeliveryAbove: null },
      settings,
    });
    expect(t.total).toBe(t.subtotal - t.discount + t.deliveryFee);
    expect(t.total).toBe(rs(300 - 30 + 40));
  });
});

describe("percent coupons", () => {
  it("applies percent off", () => {
    const { discount } = calculateDiscount([{ unitPrice: rs(250), quantity: 1 }], rs(250), percent());
    expect(discount).toBe(rs(25));
  });

  it("caps at maxDiscount", () => {
    const { discount } = calculateDiscount([{ unitPrice: rs(900), quantity: 1 }], rs(900), percent());
    expect(discount).toBe(rs(50));
  });

  it("no cap when maxDiscount is null", () => {
    const { discount } = calculateDiscount(
      [{ unitPrice: rs(900), quantity: 1 }],
      rs(900),
      percent({ maxDiscount: null }),
    );
    expect(discount).toBe(rs(90));
  });

  it("floors fractional paise", () => {
    const { discount } = calculateDiscount(
      [{ unitPrice: 9999, quantity: 1 }],
      9999,
      percent({ minOrderAmount: 0, maxDiscount: null, value: 15 }),
    );
    expect(discount).toBe(1499);
    expect(Number.isInteger(discount)).toBe(true);
  });

  it("does not apply below the minimum order and says how much more is needed", () => {
    const r = calculateDiscount([{ unitPrice: rs(150), quantity: 1 }], rs(150), percent());
    expect(r.discount).toBe(0);
    expect(r.message).toMatch(/₹50 more/);
  });

  it("applies exactly at the minimum order", () => {
    const r = calculateDiscount([{ unitPrice: rs(200), quantity: 1 }], rs(200), percent());
    expect(r.discount).toBe(rs(20));
  });

  it("clamps percent above 100", () => {
    const r = calculateDiscount(
      [{ unitPrice: rs(100), quantity: 1 }],
      rs(100),
      percent({ value: 150, minOrderAmount: 0, maxDiscount: null }),
    );
    expect(r.discount).toBe(rs(100));
  });
});

describe("flat coupons", () => {
  it("applies flat amount above the minimum", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(130), quantity: 2 }],
      coupon: flat(),
      fulfilment: "PICKUP",
      settings,
    });
    expect(t.discount).toBe(rs(30));
    expect(t.couponApplied).toBe(true);
  });

  it("never discounts more than the subtotal", () => {
    const r = calculateDiscount(
      [{ unitPrice: rs(20), quantity: 1 }],
      rs(20),
      flat({ minOrderAmount: 0, value: rs(50) }),
    );
    expect(r.discount).toBe(rs(20));
  });

  it("respects maxDiscount on flat coupons too", () => {
    const r = calculateDiscount(
      [{ unitPrice: rs(300), quantity: 1 }],
      rs(300),
      flat({ value: rs(100), maxDiscount: rs(60) }),
    );
    expect(r.discount).toBe(rs(60));
  });

  it("reports the coupon message when not met", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(100), quantity: 1 }],
      coupon: flat(),
      fulfilment: "PICKUP",
      settings,
    });
    expect(t.couponApplied).toBe(false);
    expect(t.couponMessage).toMatch(/₹150 more to use FLAT30/);
  });
});

describe("buy X get Y coupons", () => {
  it("makes the cheapest item free for buy 2 get 1", () => {
    const items = [
      { unitPrice: rs(100), quantity: 1 },
      { unitPrice: rs(80), quantity: 1 },
      { unitPrice: rs(60), quantity: 1 },
    ];
    expect(calculateDiscount(items, rs(240), bogo()).discount).toBe(rs(60));
  });

  it("counts quantities, not lines", () => {
    const items = [{ unitPrice: rs(70), quantity: 3 }];
    expect(calculateDiscount(items, rs(210), bogo()).discount).toBe(rs(70));
  });

  it("gives multiple free units for multiple groups (cheapest first)", () => {
    const items = [
      { unitPrice: rs(100), quantity: 3 },
      { unitPrice: rs(50), quantity: 3 },
    ];
    // 6 units → 2 groups → 2 free → the two ₹50 drinks
    expect(calculateDiscount(items, rs(450), bogo()).discount).toBe(rs(100));
  });

  it("ignores leftover units that don't complete a group", () => {
    const items = [{ unitPrice: rs(40), quantity: 5 }]; // 1 group of 3, 2 leftover
    expect(calculateDiscount(items, rs(200), bogo()).discount).toBe(rs(40));
  });

  it("tells the customer how many more drinks to add", () => {
    const r = calculateDiscount([{ unitPrice: rs(60), quantity: 2 }], rs(120), bogo());
    expect(r.discount).toBe(0);
    expect(r.message).toMatch(/Add 1 more drink to use BUY2GET1/);
  });

  it("supports buy 3 get 2", () => {
    const items = [
      { unitPrice: rs(10), quantity: 1 },
      { unitPrice: rs(20), quantity: 1 },
      { unitPrice: rs(30), quantity: 1 },
      { unitPrice: rs(40), quantity: 1 },
      { unitPrice: rs(50), quantity: 1 },
    ];
    expect(calculateDiscount(items, rs(150), bogo({ buyQuantity: 3, getQuantity: 2 })).discount).toBe(rs(30));
  });

  it("applies maxDiscount cap", () => {
    const items = [{ unitPrice: rs(150), quantity: 3 }];
    expect(calculateDiscount(items, rs(450), bogo({ maxDiscount: rs(100) })).discount).toBe(rs(100));
  });

  it("respects the coupon minimum order", () => {
    const items = [{ unitPrice: rs(40), quantity: 3 }];
    const r = calculateDiscount(items, rs(120), bogo({ minOrderAmount: rs(150) }));
    expect(r.discount).toBe(0);
  });

  it("rejects misconfigured coupons", () => {
    const r = calculateDiscount([{ unitPrice: rs(40), quantity: 3 }], rs(120), bogo({ buyQuantity: 0 }));
    expect(r.discount).toBe(0);
  });
});

describe("delivery fees", () => {
  const zone = { deliveryFee: rs(20), freeDeliveryAbove: rs(299) };

  it("charges no delivery for pickup", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(100), quantity: 1 }],
      fulfilment: "PICKUP",
      deliveryZone: zone,
      settings,
    });
    expect(t.deliveryFee).toBe(0);
    expect(t.freeDeliveryShortfall).toBeNull();
  });

  it("charges the zone fee below the free threshold and reports the shortfall", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(100), quantity: 2 }],
      fulfilment: "DELIVERY",
      deliveryZone: zone,
      settings,
    });
    expect(t.deliveryFee).toBe(rs(20));
    expect(t.freeDeliveryShortfall).toBe(rs(99));
  });

  it("is free at or above the threshold", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(299), quantity: 1 }],
      fulfilment: "DELIVERY",
      deliveryZone: zone,
      settings,
    });
    expect(t.deliveryFee).toBe(0);
    expect(t.freeDeliveryShortfall).toBe(0);
  });

  it("uses the discounted amount for the free delivery threshold", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(310), quantity: 1 }],
      coupon: flat(),
      fulfilment: "DELIVERY",
      deliveryZone: zone,
      settings,
    });
    // 310 − 30 = 280 < 299 → fee charged
    expect(t.deliveryFee).toBe(rs(20));
    expect(t.total).toBe(rs(300));
  });

  it("zones without a free threshold always charge", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(1000), quantity: 1 }],
      fulfilment: "DELIVERY",
      deliveryZone: { deliveryFee: rs(40), freeDeliveryAbove: null },
      settings,
    });
    expect(t.deliveryFee).toBe(rs(40));
    expect(t.freeDeliveryShortfall).toBeNull();
  });

  it("charges nothing yet when the zone is unknown", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(100), quantity: 1 }],
      fulfilment: "DELIVERY",
      deliveryZone: null,
      settings,
    });
    expect(t.deliveryFee).toBe(0);
  });
});

describe("minimum order", () => {
  it("flags the shortfall", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(60), quantity: 1 }],
      fulfilment: "PICKUP",
      settings: { minOrderAmount: rs(99) },
    });
    expect(t.meetsMinimum).toBe(false);
    expect(t.minOrderShortfall).toBe(rs(39));
  });

  it("is met exactly at the minimum", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(99), quantity: 1 }],
      fulfilment: "PICKUP",
      settings: { minOrderAmount: rs(99) },
    });
    expect(t.meetsMinimum).toBe(true);
  });

  it("is checked after the discount", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(40), quantity: 3 }],
      coupon: bogo(),
      fulfilment: "PICKUP",
      settings: { minOrderAmount: rs(99) },
    });
    // 120 − 40 = 80 < 99
    expect(t.meetsMinimum).toBe(false);
    expect(t.minOrderShortfall).toBe(rs(19));
  });

  it("does not count the delivery fee toward the minimum", () => {
    const t = calculateOrderTotals({
      items: [{ unitPrice: rs(80), quantity: 1 }],
      fulfilment: "DELIVERY",
      deliveryZone: { deliveryFee: rs(40), freeDeliveryAbove: null },
      settings: { minOrderAmount: rs(99) },
    });
    expect(t.meetsMinimum).toBe(false);
  });
});
