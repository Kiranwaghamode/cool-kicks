// Date helpers in the shop timezone (Asia/Kolkata, UTC+05:30, no daylight saving).

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Midnight IST of the day containing `date`, as a UTC Date. */
export function startOfDayIST(date = new Date()): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Monday 00:00 IST of the current week. */
export function startOfWeekIST(date = new Date()): Date {
  const start = startOfDayIST(date);
  const ist = new Date(start.getTime() + IST_OFFSET_MS);
  const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(start, -dow);
}

export function startOfMonthIST(date = new Date()): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  ist.setUTCDate(1);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

/** "2026-10-25" (IST calendar date) */
export function istDateKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parse "2026-10-25" as midnight IST. */
export function parseISTDate(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - IST_OFFSET_MS);
}

export function formatDayLabel(key: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}
