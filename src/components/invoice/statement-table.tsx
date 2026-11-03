import { formatPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import type { Statement } from "@/server/statements";
import { cn } from "@/lib/utils";

/** Signed balance: "₹1,200 Dr" (owed) / "₹300 Cr" (advance). */
export function balanceLabel(paise: number) {
  if (paise === 0) return formatPaise(0);
  return `${formatPaise(Math.abs(paise))} ${paise > 0 ? "Dr" : "Cr"}`;
}

const KIND_LABEL = { INVOICE: "Invoice", PAYMENT: "Payment", REFUND: "Refund" } as const;

export function StatementTable({ s, from, to, className }: { s: Statement; from: string; to: string; className?: string }) {
  const cell = "border-b border-black/10 px-2 py-2 align-top";
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wide uppercase opacity-70">
            <th className={cell}>Date</th>
            <th className={cell}>Type</th>
            <th className={cell}>Reference</th>
            <th className={`${cell} text-right`}>Debit</th>
            <th className={`${cell} text-right`}>Credit</th>
            <th className={`${cell} text-right`}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <td className={cell}>{formatDate(from)}</td>
            <td className={cell} colSpan={4}>
              Opening balance
            </td>
            <td className={`${cell} text-right tabular-nums`}>{balanceLabel(s.opening)}</td>
          </tr>
          {s.lines.map((l, i) => (
            <tr key={i}>
              <td className={`${cell} whitespace-nowrap`}>{formatDate(l.date)}</td>
              <td className={cell}>{KIND_LABEL[l.kind]}</td>
              <td className={cell}>
                <span className="font-semibold">{l.ref}</span>
                <span className="block text-xs opacity-70">{l.detail}</span>
              </td>
              <td className={`${cell} text-right tabular-nums`}>{l.debit ? formatPaise(l.debit) : ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{l.credit ? formatPaise(l.credit) : ""}</td>
              <td className={`${cell} text-right tabular-nums`}>{balanceLabel(l.balance)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={cell} colSpan={3}>
              Closing balance on {formatDate(to)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>{formatPaise(s.totalDebit)}</td>
            <td className={`${cell} text-right tabular-nums`}>{formatPaise(s.totalCredit)}</td>
            <td className={`${cell} text-right tabular-nums`}>{balanceLabel(s.closing)}</td>
          </tr>
        </tbody>
      </table>
      {s.uninvoiced.count > 0 && (
        <p className="mt-2 text-xs opacity-70">
          Plus {s.uninvoiced.count} order(s) worth {formatPaise(s.uninvoiced.amount)} not invoiced yet. Dr = amount owed to us, Cr = advance with us.
        </p>
      )}
    </div>
  );
}
