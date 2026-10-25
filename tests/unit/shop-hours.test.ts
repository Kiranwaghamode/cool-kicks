import { describe, expect, it } from "vitest";
import { DEFAULT_HOURS, getShopStatus, isWithinHours, parseOpeningHours, type OpeningHours } from "@/lib/shop-hours";

// Helper: a Date for a given IST wall-clock time on Wednesday 2026-10-28.
const ist = (hhmm: string, day = "2026-10-28") => new Date(`${day}T${hhmm}:00+05:30`);

const lateNight: OpeningHours = Object.fromEntries(
  Object.keys(DEFAULT_HOURS).map((d) => [d, { open: "10:00", close: "01:00", closed: false }]),
) as OpeningHours;

describe("isWithinHours", () => {
  it("is open during normal hours and closed outside them (IST)", () => {
    expect(isWithinHours(DEFAULT_HOURS, ist("09:59"))).toBe(false);
    expect(isWithinHours(DEFAULT_HOURS, ist("10:00"))).toBe(true);
    expect(isWithinHours(DEFAULT_HOURS, ist("22:59"))).toBe(true);
    expect(isWithinHours(DEFAULT_HOURS, ist("23:00"))).toBe(false);
  });

  it("supports closing after midnight", () => {
    expect(isWithinHours(lateNight, ist("00:30"))).toBe(true);
    expect(isWithinHours(lateNight, ist("01:00"))).toBe(false);
    expect(isWithinHours(lateNight, ist("23:30"))).toBe(true);
  });

  it("respects closed days", () => {
    const hours = { ...DEFAULT_HOURS, wed: { open: "10:00", close: "23:00", closed: true } };
    expect(isWithinHours(hours, ist("12:00"))).toBe(false);
  });

  it("uses IST regardless of server timezone", () => {
    // 05:00 UTC = 10:30 IST → open
    expect(isWithinHours(DEFAULT_HOURS, new Date("2026-10-28T05:00:00Z"))).toBe(true);
    // 18:00 UTC = 23:30 IST → closed
    expect(isWithinHours(DEFAULT_HOURS, new Date("2026-10-28T18:00:00Z"))).toBe(false);
  });
});

describe("getShopStatus", () => {
  it("temporary closure overrides hours", () => {
    const s = getShopStatus({ openingHours: DEFAULT_HOURS, isTemporarilyClosed: true, closureMessage: "Back Monday" }, ist("12:00"));
    expect(s.isOpen).toBe(false);
    expect(s.message).toBe("Back Monday");
  });

  it("tells customers when it opens next", () => {
    const s = getShopStatus({ openingHours: DEFAULT_HOURS, isTemporarilyClosed: false, closureMessage: null }, ist("08:00"));
    expect(s.isOpen).toBe(false);
    expect(s.message).toMatch(/opens today at 10:00 AM/);
    const late = getShopStatus({ openingHours: DEFAULT_HOURS, isTemporarilyClosed: false, closureMessage: null }, ist("23:30"));
    expect(late.message).toMatch(/opens tomorrow at 10:00 AM/);
  });

  it("says when it closes while open", () => {
    const s = getShopStatus({ openingHours: DEFAULT_HOURS, isTemporarilyClosed: false, closureMessage: null }, ist("15:00"));
    expect(s.isOpen).toBe(true);
    expect(s.message).toMatch(/closes at 11:00 PM/);
  });
});

describe("parseOpeningHours", () => {
  it("falls back to defaults for bad data", () => {
    expect(parseOpeningHours(null)).toEqual(DEFAULT_HOURS);
    expect(parseOpeningHours({ mon: { open: "08:00" } }).mon.open).toBe("08:00");
  });
});
