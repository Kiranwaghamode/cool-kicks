// Opening-hours logic. Pure functions, evaluated in the shop timezone (Asia/Kolkata).

export const SHOP_TIMEZONE = "Asia/Kolkata";
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type DayHours = { open: string; close: string; closed: boolean };
export type OpeningHours = Record<Weekday, DayHours>;

export const DEFAULT_HOURS: OpeningHours = Object.fromEntries(
  WEEKDAYS.map((d) => [d, { open: "10:00", close: "23:00", closed: false }]),
) as OpeningHours;

/** Normalise unknown JSON from the DB into OpeningHours. */
export function parseOpeningHours(value: unknown): OpeningHours {
  const out = { ...DEFAULT_HOURS };
  if (value && typeof value === "object") {
    for (const d of WEEKDAYS) {
      const v = (value as Record<string, unknown>)[d] as Partial<DayHours> | undefined;
      if (v && typeof v === "object") {
        out[d] = {
          open: typeof v.open === "string" ? v.open : out[d].open,
          close: typeof v.close === "string" ? v.close : out[d].close,
          closed: Boolean(v.closed),
        };
      }
    }
  }
  return out;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Weekday + minutes-since-midnight of `date` in the shop timezone. */
export function shopClock(date: Date): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as Weekday;
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const prevDay = (d: Weekday): Weekday => WEEKDAYS[(WEEKDAYS.indexOf(d) + 6) % 7];
const nextDay = (d: Weekday, n = 1): Weekday => WEEKDAYS[(WEEKDAYS.indexOf(d) + n) % 7];

/** Is the shop open at this moment per its weekly hours? Supports closing after midnight. */
export function isWithinHours(hours: OpeningHours, date: Date): boolean {
  const { day, minutes } = shopClock(date);
  const today = hours[day];
  if (!today.closed) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true;
  }
  // Yesterday's session may run past midnight (e.g. 10:00–01:00)
  const y = hours[prevDay(day)];
  if (!y.closed) {
    const o = toMinutes(y.open);
    const c = toMinutes(y.close);
    if (c <= o && minutes < c) return true;
  }
  return false;
}

export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type ShopStatus = {
  isOpen: boolean;
  /** Why it's closed, or when it closes. Human readable. */
  message: string;
  temporarilyClosed: boolean;
};

export function getShopStatus(
  settings: { openingHours: unknown; isTemporarilyClosed: boolean; closureMessage: string | null },
  date: Date = new Date(),
): ShopStatus {
  const hours = parseOpeningHours(settings.openingHours);
  if (settings.isTemporarilyClosed) {
    return {
      isOpen: false,
      temporarilyClosed: true,
      message: settings.closureMessage || "We're temporarily closed. Please check back soon.",
    };
  }
  const { day, minutes } = shopClock(date);
  if (isWithinHours(hours, date)) {
    const today = hours[day];
    const yesterday = hours[prevDay(day)];
    const inYesterdaySession =
      toMinutes(yesterday.close) <= toMinutes(yesterday.open) && minutes < toMinutes(yesterday.close) && !yesterday.closed;
    const closeAt = inYesterdaySession ? yesterday.close : today.close;
    return { isOpen: true, temporarilyClosed: false, message: `Open now · closes at ${formatTime12(closeAt)}` };
  }
  // Find next opening
  for (let i = 0; i < 8; i++) {
    const d = nextDay(day, i);
    const h = hours[d];
    if (h.closed) continue;
    if (i === 0 && minutes >= toMinutes(h.open)) continue;
    const when = i === 0 ? "today" : i === 1 ? "tomorrow" : WEEKDAY_LABELS[d];
    return {
      isOpen: false,
      temporarilyClosed: false,
      message: `Closed now · opens ${when} at ${formatTime12(h.open)}`,
    };
  }
  return { isOpen: false, temporarilyClosed: false, message: "Closed now" };
}

/** "10:00 AM – 11:00 PM" for a day, or "Closed". */
export function describeDay(h: DayHours): string {
  return h.closed ? "Closed" : `${formatTime12(h.open)} – ${formatTime12(h.close)}`;
}

/** Short summary when every day has the same hours: "Open daily: 10:00 AM – 11:00 PM". */
export function summariseHours(hours: OpeningHours): string {
  const first = hours.mon;
  const same = WEEKDAYS.every(
    (d) => hours[d].open === first.open && hours[d].close === first.close && hours[d].closed === first.closed,
  );
  if (same) return first.closed ? "Closed" : `Open daily: ${describeDay(first)}`;
  const today = hours[shopClock(new Date()).day];
  return `Today: ${describeDay(today)}`;
}
