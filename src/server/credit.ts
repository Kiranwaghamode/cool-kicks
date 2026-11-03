import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

export type CreditSummary = {
  /** Credit ordering allowed for this business. */
  isActive: boolean;
  limit: number;
  days: number;
  /** Unpaid balance on all open wholesale orders (paise). */
  outstanding: number;
  /** Part of `outstanding` on invoices past their due date. */
  overdue: number;
  overdueCount: number;
  /** limit − outstanding (never below 0). */
  available: number;
};

/**
 * Credit position, always calculated from orders and payments (never a stored balance that
 * could drift). Cancelled / rejected orders don't count.
 */
export async function getCreditSummary(businessId: string, tx: Tx = db): Promise<CreditSummary> {
  const [account, open, overdue] = await Promise.all([
    tx.creditAccount.findUnique({ where: { businessId } }),
    tx.$queryRaw<{ balance: bigint | null }[]>`
      SELECT SUM(GREATEST("total" - "amountPaid", 0)) AS balance
      FROM "Order"
      WHERE "businessId" = ${businessId} AND "channel" = 'WHOLESALE'
        AND "status" NOT IN ('CANCELLED', 'REJECTED')`,
    tx.$queryRaw<{ balance: bigint | null; n: bigint }[]>`
      SELECT SUM(GREATEST(o."total" - o."amountPaid", 0)) AS balance,
             COUNT(*) FILTER (WHERE o."total" > o."amountPaid") AS n
      FROM "Invoice" i JOIN "Order" o ON o."id" = i."orderId"
      WHERE i."businessId" = ${businessId} AND i."status" = 'ISSUED' AND i."dueDate" < now()
        AND o."status" NOT IN ('CANCELLED', 'REJECTED')`,
  ]);
  const outstanding = Number(open[0]?.balance ?? 0);
  const limit = account?.creditLimit ?? 0;
  return {
    isActive: !!account?.isActive,
    limit,
    days: account?.creditDays ?? 15,
    outstanding,
    overdue: Number(overdue[0]?.balance ?? 0),
    overdueCount: Number(overdue[0]?.n ?? 0),
    available: Math.max(0, limit - outstanding),
  };
}

/**
 * Lock the business's credit row for the rest of the transaction, so two orders placed at the
 * same moment can't both squeeze under the limit.
 */
export async function lockCreditAccount(tx: Prisma.TransactionClient, businessId: string) {
  await tx.$queryRaw`SELECT "businessId" FROM "CreditAccount" WHERE "businessId" = ${businessId} FOR UPDATE`;
}
