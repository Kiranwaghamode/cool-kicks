import { formatPaise } from "@/lib/money";

/**
 * Can a business place an order of `orderTotal` paise on credit?
 * Blocked when credit is off or when outstanding + this order would exceed the limit.
 */
export function creditDecision(
  summary: { isActive: boolean; limit: number; outstanding: number },
  orderTotal: number,
): { ok: true } | { ok: false; reason: string } {
  if (!summary.isActive) return { ok: false, reason: "Credit isn't enabled for your account. Please choose advance payment or contact us." };
  const after = summary.outstanding + orderTotal;
  if (after > summary.limit) {
    const available = Math.max(0, summary.limit - summary.outstanding);
    return {
      ok: false,
      reason: `This order is over your credit limit. Available credit is ${formatPaise(available)} – pay your outstanding balance or choose advance payment.`,
    };
  }
  return { ok: true };
}

/** Due date for a credit invoice: issue date + credit days. */
export function dueDateFor(issuedAt: Date, creditDays: number) {
  return new Date(issuedAt.getTime() + Math.max(0, creditDays) * 86_400_000);
}
