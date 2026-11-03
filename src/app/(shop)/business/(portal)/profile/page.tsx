import { requireBusiness } from "@/server/business-auth";
import { db } from "@/lib/db";
import { stateName } from "@/lib/gst";
import { BUSINESS_TYPE_LABELS } from "@/lib/types";
import { ProfileView } from "./profile-view";

export const metadata = { title: "Profile" };

export default async function BusinessProfilePage() {
  const business = await requireBusiness();
  const [row, addresses, documents] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: business.id }, select: { pan: true, email: true, createdAt: true } }),
    db.businessAddress.findMany({ where: { businessId: business.id, isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    db.businessDocument.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, fileName: true, size: true, status: true, note: true, createdAt: true },
    }),
  ]);

  const details: [string, string][] = [
    ["Registered name", business.legalName],
    ["Trade name", business.tradeName ?? "—"],
    ["Business type", BUSINESS_TYPE_LABELS[business.type]],
    ["GSTIN", business.gstin ?? "Not registered"],
    ["PAN", row.pan ?? "—"],
    ["State", stateName(business.stateCode)],
    ["Contact person", business.contactName],
    ["Login mobile", business.phone],
    ["Email", row.email ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Profile</h1>
      <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6">
        <h2 className="font-bold">Business details</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{k}</dt>
              <dd className="font-semibold break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-ink-muted">To change your registered details or GSTIN, please contact us – we re-verify any changes.</p>
      </section>
      <ProfileView
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          contactName: a.contactName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2 ?? "",
          landmark: a.landmark ?? "",
          area: a.area,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          isDefault: a.isDefault,
        }))}
        documents={documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
        defaultStateCode={business.stateCode}
      />
    </div>
  );
}
