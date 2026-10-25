import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ACCESS, type Area } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export type StaffSession = { id: string; name: string; email: string; role: Role };

/** Current staff user, re-checked against the database (deactivated users lose access immediately). */
export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.staffUser.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

/**
 * Require a logged-in staff member with one of the given roles.
 * Pages: redirects to login (no session) or the 403 page (wrong role).
 * Use `requireRoleForAction` inside server actions to get an error instead of a redirect.
 */
export async function requireRole(roles: readonly Role[] | Area): Promise<StaffSession> {
  const allowed = typeof roles === "string" ? ACCESS[roles] : roles;
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (!(allowed as readonly Role[]).includes(staff.role)) redirect("/admin/forbidden");
  return staff;
}

/** For server actions: throws ForbiddenError instead of redirecting. */
export async function requireRoleForAction(roles: readonly Role[] | Area): Promise<StaffSession> {
  const allowed = typeof roles === "string" ? ACCESS[roles] : roles;
  const staff = await getStaff();
  if (!staff) throw new ForbiddenError("Your session has expired. Please log in again.");
  if (!(allowed as readonly Role[]).includes(staff.role)) throw new ForbiddenError();
  return staff;
}

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Wrap an admin server action body: converts ForbiddenError / unknown errors into ActionResult. */
export async function adminAction<T>(
  roles: readonly Role[] | Area,
  fn: (staff: StaffSession) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const staff = await requireRoleForAction(roles);
    return await fn(staff);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    console.error("Admin action failed", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
