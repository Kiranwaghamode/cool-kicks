import "server-only";
import { db } from "@/lib/db";
import { addDays, istDateKey, parseISTDate, startOfDayIST, startOfMonthIST } from "@/lib/dates";
import { PAYMENT_MODE_LABELS } from "@/lib/types";

export type StatementLine = {
  date: string;
  kind: "INVOICE" | "PAYMENT" | "REFUND";
  ref: string;
  detail: string;
  debit: number;
  credit: number;
  balance: number;
};

/** Resolve ?from=&to= (IST dates). Defaults to this month; `to` is inclusive for display. */
export function statementRange(fromStr?: string, toStr?: string) {
  const from = (fromStr && parseISTDate(fromStr)) || startOfMonthIST();
  const toDay = (toStr && parseISTDate(toStr)) || startOfDayIST();
  const end = addDays(toDay < from ? from : toDay, 1);
  return { from, end, fromKey: istDateKey(from), toKey: istDateKey(addDays(end, -1)) };
}

/**
 * Customer account statement: invoices are debits, payments credits, refunds debits.
 * Balance > 0 means the business owes money; < 0 means an advance is held.
 * Cancelled invoices are void and left out.
 */
export async function getStatement(businessId: string, from: Date, end: Date) {
  const [invBefore, payBefore, refBefore, invoices, payments, uninvoiced] = await Promise.all([
    db.invoice.aggregate({ where: { businessId, status: "ISSUED", issuedAt: { lt: from } }, _sum: { total: true } }),
    db.payment.aggregate({ where: { businessId, kind: "PAYMENT", receivedAt: { lt: from } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { businessId, kind: "REFUND", receivedAt: { lt: from } }, _sum: { amount: true } }),
    db.invoice.findMany({
      where: { businessId, status: "ISSUED", issuedAt: { gte: from, lt: end } },
      orderBy: { issuedAt: "asc" },
      select: { number: true, issuedAt: true, dueDate: true, total: true, order: { select: { orderNumber: true, poNumber: true } } },
    }),
    db.payment.findMany({
      where: { businessId, receivedAt: { gte: from, lt: end } },
      orderBy: { receivedAt: "asc" },
      select: { kind: true, amount: true, mode: true, reference: true, receivedAt: true, order: { select: { orderNumber: true } } },
    }),
    db.order.aggregate({
      where: { businessId, channel: "WHOLESALE", invoice: null, status: { notIn: ["CANCELLED", "REJECTED"] } },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const opening = (invBefore._sum.total ?? 0) - (payBefore._sum.amount ?? 0) + (refBefore._sum.amount ?? 0);
  const entries = [
    ...invoices.map((i) => ({
      at: i.issuedAt,
      kind: "INVOICE" as const,
      ref: i.number,
      detail: `Order ${i.order.orderNumber}${i.order.poNumber ? ` · PO ${i.order.poNumber}` : ""} · due ${istDateKey(i.dueDate)}`,
      debit: i.total,
      credit: 0,
    })),
    ...payments.map((p) => ({
      at: p.receivedAt,
      kind: p.kind === "PAYMENT" ? ("PAYMENT" as const) : ("REFUND" as const),
      ref: p.order.orderNumber,
      detail: `${PAYMENT_MODE_LABELS[p.mode]}${p.reference ? ` · ${p.reference}` : ""}`,
      debit: p.kind === "REFUND" ? p.amount : 0,
      credit: p.kind === "PAYMENT" ? p.amount : 0,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === "INVOICE" ? -1 : 1));

  let balance = opening;
  const lines: StatementLine[] = entries.map((e) => {
    balance += e.debit - e.credit;
    return { date: e.at.toISOString(), kind: e.kind, ref: e.ref, detail: e.detail, debit: e.debit, credit: e.credit, balance };
  });

  return {
    opening,
    closing: balance,
    lines,
    totalDebit: lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
    uninvoiced: { amount: uninvoiced._sum.total ?? 0, count: uninvoiced._count._all },
  };
}

export type Statement = Awaited<ReturnType<typeof getStatement>>;
