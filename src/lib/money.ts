/**
 * Money helpers. All money in the app is stored as integer paise (₹80 = 8000).
 * Never use floats for stored amounts.
 */

export type Paise = number;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format paise as rupees, e.g. 8000 -> "₹80", 8050 -> "₹80.50". */
export function formatPaise(paise: Paise): string {
  assertPaise(paise);
  return inrFormatter.format(paise / 100);
}

/** Convert a rupee amount (from a form input) to integer paise. "80.5" -> 8050 */
export function rupeesToPaise(rupees: number | string): Paise {
  const value = typeof rupees === "string" ? Number(rupees.trim()) : rupees;
  if (!Number.isFinite(value)) throw new Error(`Invalid rupee amount: ${rupees}`);
  return Math.round(value * 100);
}

/** Convert paise to a rupee number for form inputs. 8050 -> 80.5 */
export function paiseToRupees(paise: Paise): number {
  assertPaise(paise);
  return paise / 100;
}

export function assertPaise(value: number): asserts value is Paise {
  if (!Number.isInteger(value)) throw new Error(`Money must be integer paise, got ${value}`);
}
