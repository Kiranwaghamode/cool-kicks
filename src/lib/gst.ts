/**
 * GST helpers (client-safe, pure). Rates are basis points (500 = 5%), money is integer paise.
 *
 * Intra-state supply (buyer state = shop state): CGST + SGST, each half the rate.
 * Inter-state supply: IGST at the full rate.
 */

export const GST_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

const STATE_BY_CODE = new Map(GST_STATES.map((s) => [s.code, s.name]));

export function stateName(code: string | null | undefined): string {
  return (code && STATE_BY_CODE.get(code)) || "";
}

export function isValidStateCode(code: string) {
  return STATE_BY_CODE.has(code);
}

/** GST rates offered in the product form (basis points). */
export const GST_RATES_BPS = [0, 500, 1200, 1800, 2800] as const;

export function formatRate(bps: number) {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

// ───────────────────────── GSTIN / PAN ─────────────────────────

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

/** The 15th character of a GSTIN is a mod-36 checksum of the first 14. */
export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARS.indexOf(first14[i]);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

export function normalizeGstin(input: string) {
  return input.replace(/\s/g, "").toUpperCase();
}

/** Returns null when valid, otherwise a short reason. */
export function gstinProblem(input: string): string | null {
  const g = normalizeGstin(input);
  if (!GSTIN_PATTERN.test(g)) return "GSTIN should be 15 characters, like 27ABCDE1234F1Z5";
  if (!isValidStateCode(g.slice(0, 2))) return "The first two digits are not a valid state code";
  if (gstinChecksum(g.slice(0, 14)) !== g[14]) return "This GSTIN doesn't look right – please check it";
  return null;
}

export function isValidGstin(input: string) {
  return gstinProblem(input) === null;
}

export function panFromGstin(gstin: string) {
  return normalizeGstin(gstin).slice(2, 12);
}

export function isValidPan(input: string) {
  return PAN_PATTERN.test(input.trim().toUpperCase());
}

// ───────────────────────── Tax maths ─────────────────────────

export type LineTax = { cgst: number; sgst: number; igst: number; tax: number };

/**
 * GST on one taxable amount. Intra-state splits into two equal halves (each rounded), so
 * CGST always equals SGST on an invoice line.
 */
export function taxForAmount(taxable: number, rateBps: number, interState: boolean): LineTax {
  if (!Number.isInteger(taxable) || taxable < 0) throw new Error(`taxable must be non-negative integer paise, got ${taxable}`);
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error(`invalid GST rate ${rateBps}`);
  if (interState) {
    const igst = Math.round((taxable * rateBps) / 10000);
    return { cgst: 0, sgst: 0, igst, tax: igst };
  }
  const half = Math.round((taxable * rateBps) / 20000);
  return { cgst: half, sgst: half, igst: 0, tax: half * 2 };
}

// ───────────────────────── Invoice numbering ─────────────────────────

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Indian financial year (April–March) in IST, e.g. 3 Nov 2026 → "26-27". */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  return `${two(start)}-${two(start + 1)}`;
}

/** e.g. CK/26-27/00012 (16 chars max, as GST rules require). */
export function formatInvoiceNumber(fy: string, n: number) {
  return `CK/${fy}/${String(n).padStart(5, "0")}`;
}

/** Amount in words for invoices: 123456 paise → "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only". */
export function amountInWords(paise: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
  const three = (n: number) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
  };
  const words = (n: number): string => {
    if (n === 0) return "Zero";
    const parts: string[] = [];
    const crore = Math.floor(n / 10_000_000);
    const lakh = Math.floor((n % 10_000_000) / 100_000);
    const thousand = Math.floor((n % 100_000) / 1000);
    const rest = n % 1000;
    if (crore) parts.push(`${words(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(" ");
  };
  const rupees = Math.floor(Math.abs(paise) / 100);
  const p = Math.abs(paise) % 100;
  return `Rupees ${words(rupees)}${p ? ` and ${two(p)} Paise` : ""} Only`;
}
