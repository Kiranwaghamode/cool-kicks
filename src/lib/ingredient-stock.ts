// Ingredient batch rules (pure – shared by server code, admin UI and unit tests).
// Quantities here are integer "milli-units" (1 kg = 1000) so the maths is exact,
// matching the Decimal(12, 3) columns.

/** Batches expiring within this many days are flagged on the inventory page and dashboard. */
export const EXPIRY_WARNING_DAYS = 3;
const DAY_MS = 86_400_000;

export type ExpiryState = "none" | "ok" | "soon" | "expired";

/** `expiresAt` is the end of the expiry day (IST); null = doesn't expire. */
export function expiryState(expiresAt: Date | string | null, now = new Date()): ExpiryState {
  if (!expiresAt) return "none";
  const t = new Date(expiresAt).getTime();
  if (t <= now.getTime()) return "expired";
  if (t - now.getTime() <= EXPIRY_WARNING_DAYS * DAY_MS) return "soon";
  return "ok";
}

export const isUsable = (b: { remaining: number; expiresAt: Date | string | null }, now = new Date()) =>
  b.remaining > 0 && expiryState(b.expiresAt, now) !== "expired";

export const toMilli = (n: number | string | { toString(): string }) => Math.round(Number(n.toString()) * 1000);
export const fromMilli = (n: number) => n / 1000;

export type AllocBatch = { id: string; remaining: number; expiresAt: Date | null; receivedAt: Date };
export type Allocation = { takes: { id: string; qty: number }[]; shortfall: number };

const byExpiry = (a: AllocBatch, b: AllocBatch) =>
  (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) || a.receivedAt.getTime() - b.receivedAt.getTime();

function take(sorted: AllocBatch[], need: number): Allocation {
  const takes: Allocation["takes"] = [];
  let left = need;
  for (const b of sorted) {
    if (left <= 0) break;
    if (b.remaining <= 0) continue;
    const qty = Math.min(left, b.remaining);
    takes.push({ id: b.id, qty });
    left -= qty;
  }
  return { takes, shortfall: Math.max(0, left) };
}

/** Orders / production: only usable (not expired) stock, earliest expiry first, no-expiry stock last. */
export function allocateForUsage(batches: AllocBatch[], need: number, now = new Date()): Allocation {
  return take(batches.filter((b) => isUsable(b, now)).sort(byExpiry), need);
}

/** Manual reduce (wastage, corrections): expired stock first, then the earliest expiry. */
export function allocateForReduction(batches: AllocBatch[], need: number, now = new Date()): Allocation {
  const expired = batches.filter((b) => b.remaining > 0 && !isUsable(b, now)).sort(byExpiry);
  const usable = batches.filter((b) => isUsable(b, now)).sort(byExpiry);
  return take([...expired, ...usable], need);
}

/** Summary used by the inventory list and dashboard. */
export function summariseBatches(batches: { remaining: number; expiresAt: Date | string | null }[], now = new Date()) {
  let total = 0;
  let usable = 0;
  let expired = 0;
  let expiringSoon = 0;
  let nextExpiry: Date | null = null;
  for (const b of batches) {
    if (b.remaining <= 0) continue;
    total += b.remaining;
    const st = expiryState(b.expiresAt, now);
    if (st === "expired") {
      expired += b.remaining;
      continue;
    }
    usable += b.remaining;
    if (st === "soon") expiringSoon += b.remaining;
    if (b.expiresAt) {
      const d = new Date(b.expiresAt);
      if (!nextExpiry || d < nextExpiry) nextExpiry = d;
    }
  }
  return { total, usable, expired, expiringSoon, nextExpiry };
}
