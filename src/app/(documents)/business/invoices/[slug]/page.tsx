import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { PrintBar } from "@/components/invoice/print-bar";
import { requireBusiness } from "@/server/business-auth";
import type { InvoiceSnapshot } from "@/server/invoices";
import { db } from "@/lib/db";
import { invoiceNumberFromSlug } from "@/lib/gst";

export const metadata = { title: "Invoice" };

/** A business can view and print its own invoices. */
export default async function BusinessInvoicePage({ params }: PageProps<"/business/invoices/[slug]">) {
  const business = await requireBusiness();
  const number = invoiceNumberFromSlug((await params).slug);
  if (!number) notFound();
  const inv = await db.invoice.findFirst({ where: { number, businessId: business.id }, include: { order: { select: { amountPaid: true, orderNumber: true } } } });
  if (!inv) notFound();
  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <PrintBar backHref={`/business/orders/${inv.order.orderNumber}`} backLabel="Order" />
      <InvoiceDocument
        inv={inv.snapshot as unknown as InvoiceSnapshot}
        amountPaid={inv.order.amountPaid}
        cancelled={inv.status === "CANCELLED" ? { at: (inv.cancelledAt ?? inv.issuedAt).toISOString(), reason: inv.cancelReason } : null}
      />
    </>
  );
}
