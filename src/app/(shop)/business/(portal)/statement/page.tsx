import { Printer } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { StatementTable, balanceLabel } from "@/components/invoice/statement-table";
import { requireBusiness } from "@/server/business-auth";
import { getCreditSummary } from "@/server/credit";
import { getStatement, statementRange } from "@/server/statements";
import { formatPaise } from "@/lib/money";

export const metadata = { title: "Account statement" };

export default async function BusinessStatementPage({ searchParams }: PageProps<"/business/statement">) {
  const business = await requireBusiness({ approved: true });
  const sp = await searchParams;
  const range = statementRange(typeof sp.from === "string" ? sp.from : undefined, typeof sp.to === "string" ? sp.to : undefined);
  const [statement, credit] = await Promise.all([getStatement(business.id, range.from, range.end), getCreditSummary(business.id)]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Account statement</h1>
          <p className="text-ink-soft">Invoices, payments and your running balance.</p>
        </div>
        <LinkButton href={`/business/statement/print?from=${range.fromKey}&to=${range.toKey}`} variant="outline" target="_blank">
          <Printer className="size-4" aria-hidden /> Print / PDF
        </LinkButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Closing balance", balanceLabel(statement.closing)],
          ["Outstanding on open orders", formatPaise(credit.outstanding)],
          ["Overdue", formatPaise(credit.overdue)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card bg-surface p-5 shadow-warm-soft">
            <p className="text-sm font-semibold text-ink-soft">{k}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 shadow-warm-soft">
        <label className="text-sm font-semibold">
          From
          <Input type="date" name="from" defaultValue={range.fromKey} className="mt-1 h-10 w-44" />
        </label>
        <label className="text-sm font-semibold">
          To
          <Input type="date" name="to" defaultValue={range.toKey} className="mt-1 h-10 w-44" />
        </label>
        <Button type="submit" size="sm">
          Show
        </Button>
      </form>

      <section className="rounded-card bg-surface p-4 shadow-warm-soft">
        <StatementTable s={statement} from={range.fromKey} to={range.toKey} />
      </section>
    </div>
  );
}
