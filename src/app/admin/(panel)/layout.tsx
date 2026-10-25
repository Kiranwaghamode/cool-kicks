import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Cool Kick Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireRole("dashboard");
  const [settings, pendingOrders, unreadMessages] = await Promise.all([
    db.shopSettings.findUnique({ where: { id: 1 }, select: { isTemporarilyClosed: true } }),
    db.order.count({ where: { status: "PLACED" } }),
    can(staff.role, "messages") ? db.contactMessage.count({ where: { isRead: false } }) : Promise.resolve(0),
  ]);
  return (
    <AdminShell
      user={{ name: staff.name, email: staff.email, role: staff.role }}
      shopOpen={!settings?.isTemporarilyClosed}
      pendingOrders={pendingOrders}
      unreadMessages={unreadMessages}
    >
      {children}
    </AdminShell>
  );
}
