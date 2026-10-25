import { PageHeader, Panel } from "@/components/admin/ui";
import { StaffManager } from "./staff-manager";
import { requireRole } from "@/server/auth-guard";
import { db } from "@/lib/db";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireRole("staff");
  const staff = await db.staffUser.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
  return (
    <>
      <PageHeader title="Staff" description="Who can log in to the dashboard, and what they can do." />
      <Panel>
        <StaffManager
          meId={me.id}
          staff={staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt?.toISOString() ?? null, createdAt: s.createdAt.toISOString() }))}
        />
      </Panel>
      <p className="mt-4 text-sm text-ink-muted">
        <strong>Owner</strong>: everything. <strong>Manager</strong>: products, inventory, orders, coupons, reports. <strong>Staff</strong>: view and update orders only.
      </p>
    </>
  );
}
