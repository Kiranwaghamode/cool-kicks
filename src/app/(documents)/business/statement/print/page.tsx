import { PrintBar } from "@/components/invoice/print-bar";
import { StatementHeader } from "@/components/invoice/statement-header";
import { StatementTable } from "@/components/invoice/statement-table";
import { requireBusiness } from "@/server/business-auth";
import { getStatement, statementRange } from "@/server/statements";
import { db } from "@/lib/db";

export const metadata = { title: "Account statement" };

export default async function BusinessStatementPrintPage({ searchParams }: PageProps<"/business/statement/print">) {
  const business = await requireBusiness({ approved: true });
  const sp = await searchParams;
  const range = statementRange(typeof sp.from === "string" ? sp.from : undefined, typeof sp.to === "string" ? sp.to : undefined);
  const [statement, settings] = await Promise.all([getStatement(business.id, range.from, range.end), db.shopSettings.findUniqueOrThrow({ where: { id: 1 } })]);
  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <PrintBar backHref={`/business/statement?from=${range.fromKey}&to=${range.toKey}`} backLabel="Statement" />
      <article className="mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
        <StatementHeader seller={{ name: settings.legalName || settings.shopName, address: settings.address, gstin: settings.gstin }} buyer={business} from={range.fromKey} to={range.toKey} />
        <StatementTable s={statement} from={range.fromKey} to={range.toKey} className="mt-4" />
      </article>
    </>
  );
}
