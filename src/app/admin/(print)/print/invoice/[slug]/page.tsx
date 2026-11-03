import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintBar } from "@/components/invoice/print-bar";
import { requireRole } from "@/server/auth-guard";
import type { InvoiceSnapshot } from "@/server/invoices";
import { db } from "@/lib/db";
import { invoiceNumberFromSlug } from "@/lib/gst";

export const metadata = { title: "Invoice" };

export default async function AdminInvoicePrintPage({ params }: PageProps<"/admin/print/invoice/[slug]">) {
  await requireRole("invoices");
  const number = invoiceNumberFromSlug((await params).slug);
  if (!number) notFound();
  const inv = await db.invoice.findUnique({ where: { number }, include: { order: { select: { amountPaid: true } } } });
  if (!inv) notFound();
  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <PrintBar backHref="/admin/invoices" backLabel="Invoices" />
      <InvoiceDocument
        inv={inv.snapshot as unknown as InvoiceSnapshot}
        amountPaid={inv.order.amountPaid}
        cancelled={inv.status === "CANCELLED" ? { at: (inv.cancelledAt ?? inv.issuedAt).toISOString(), reason: inv.cancelReason } : null}
      />
    </>
  );
}
