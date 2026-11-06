import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getShopName } from "@/server/brand";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const name = await getShopName();
  return {
    title: { default: "Admin", template: `%s | ${name} Admin` },
    robots: { index: false, follow: false },
  };
}

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireRole("dashboard");
  const [settings, pendingOrders, unreadMessages, pendingBusinesses, quoteRequests] = await Promise.all([
    db.shopSettings.findUnique({ where: { id: 1 }, select: { isTemporarilyClosed: true } }),
    db.order.count({ where: { status: "PLACED" } }),
    can(staff.role, "messages") ? db.contactMessage.count({ where: { isRead: false } }) : Promise.resolve(0),
    can(staff.role, "businesses") ? db.business.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    can(staff.role, "quotations") ? db.quotation.count({ where: { status: "REQUESTED" } }) : Promise.resolve(0),
  ]);
  return (
    <AdminShell
      user={{ name: staff.name, email: staff.email, role: staff.role }}
      shopOpen={!settings?.isTemporarilyClosed}
      pendingOrders={pendingOrders}
      unreadMessages={unreadMessages}
      pendingBusinesses={pendingBusinesses}
      quoteRequests={quoteRequests}
    >
      {children}
    </AdminShell>
  );
}
