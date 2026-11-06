import { describe, expect, it } from "vitest";
import { allocateForReduction, allocateForUsage, expiryState, summariseBatches, toMilli, type AllocBatch } from "@/lib/ingredient-stock";

const now = new Date("2026-11-05T06:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const b = (id: string, remaining: number, expiresAt: Date | null, receivedDaysAgo = 0): AllocBatch => ({
  id,
  remaining,
  expiresAt,
  receivedAt: day(-receivedDaysAgo),
});

describe("expiryState", () => {
  it("classifies dates", () => {
    expect(expiryState(null, now)).toBe("none");
    expect(expiryState(day(-1), now)).toBe("expired");
    expect(expiryState(now, now)).toBe("expired");
    expect(expiryState(day(2), now)).toBe("soon");
    expect(expiryState(day(3), now)).toBe("soon");
    expect(expiryState(day(10), now)).toBe("ok");
  });
});

describe("allocateForUsage (orders)", () => {
  it("uses the earliest expiry first and no-expiry stock last", () => {
    const res = allocateForUsage([b("none", 5000, null, 9), b("late", 2000, day(9)), b("early", 1000, day(2))], 2500, now);
    expect(res.takes).toEqual([
      { id: "early", qty: 1000 },
      { id: "late", qty: 1500 },
    ]);
    expect(res.shortfall).toBe(0);
  });

  it("never uses expired stock and reports a shortfall", () => {
    const res = allocateForUsage([b("old", 3000, day(-1)), b("fresh", 500, day(5))], 1200, now);
    expect(res.takes).toEqual([{ id: "fresh", qty: 500 }]);
    expect(res.shortfall).toBe(700);
  });

  it("breaks ties by the oldest delivery", () => {
    const res = allocateForUsage([b("new", 1000, day(4), 0), b("old", 1000, day(4), 3)], 1500, now);
    expect(res.takes.map((t) => t.id)).toEqual(["old", "new"]);
  });
});

describe("allocateForReduction (wastage)", () => {
  it("removes expired stock first", () => {
    const res = allocateForReduction([b("fresh", 1000, day(5)), b("old", 400, day(-2))], 600, now);
    expect(res.takes).toEqual([
      { id: "old", qty: 400 },
      { id: "fresh", qty: 200 },
    ]);
  });
});

describe("summariseBatches", () => {
  it("counts only unexpired stock as usable", () => {
    const s = summariseBatches(
      [
        { remaining: 2000, expiresAt: day(-1) },
        { remaining: 1000, expiresAt: day(2) },
        { remaining: 500, expiresAt: day(20) },
        { remaining: 300, expiresAt: null },
        { remaining: 0, expiresAt: day(1) },
      ],
      now,
    );
    expect(s).toMatchObject({ total: 3800, usable: 1800, expired: 2000, expiringSoon: 1000 });
    expect(s.nextExpiry?.getTime()).toBe(day(2).getTime());
  });
});

describe("toMilli", () => {
  it("converts decimals exactly", () => {
    expect(toMilli("0.412")).toBe(412);
    expect(toMilli(1.005)).toBe(1005);
  });
});
