import { notFound } from "next/navigation";
import { PrintBar } from "@/components/invoice/print-bar";
import { StatementHeader } from "@/components/invoice/statement-header";
import { StatementTable } from "@/components/invoice/statement-table";
import { requireRole } from "@/server/auth-guard";
import { getStatement, statementRange } from "@/server/statements";
import { db } from "@/lib/db";

export const metadata = { title: "Statement" };

export default async function AdminStatementPrintPage({ params, searchParams }: PageProps<"/admin/print/statement/[businessId]">) {
  await requireRole("businesses");
  const { businessId } = await params;
  const sp = await searchParams;
  const range = statementRange(typeof sp.from === "string" ? sp.from : undefined, typeof sp.to === "string" ? sp.to : undefined);
  const [business, settings] = await Promise.all([
    db.business.findUnique({ where: { id: businessId }, select: { legalName: true, tradeName: true, gstin: true, phone: true } }),
    db.shopSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (!business) notFound();
  const statement = await getStatement(businessId, range.from, range.end);
  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <PrintBar backHref={`/admin/businesses/${businessId}`} backLabel="Business" />
      <article className="mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
        <StatementHeader seller={{ name: settings.legalName || settings.shopName, address: settings.address, gstin: settings.gstin }} buyer={business} from={range.fromKey} to={range.toKey} />
        <StatementTable s={statement} from={range.fromKey} to={range.toKey} className="mt-4" />
      </article>
    </>
  );
}
