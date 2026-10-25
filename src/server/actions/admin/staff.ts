"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";

const password = z.string().min(8, "Password must be at least 8 characters").max(100);
const role = z.enum(["OWNER", "MANAGER", "STAFF"]);

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role,
  password,
});

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

async function activeOwnerCount(excludeId?: string) {
  return db.staffUser.count({ where: { role: "OWNER", isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export async function createStaff(input: z.input<typeof createSchema>) {
  return adminAction("staff", async () => {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
    const exists = await db.staffUser.findUnique({ where: { email: parsed.data.email } });
    if (exists) return { ok: false, error: "A staff member with that email already exists.", fieldErrors: { email: "Already in use" } };
    await db.staffUser.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
      },
    });
    revalidatePath("/admin/staff");
    return { ok: true, message: `${parsed.data.name} added` };
  });
}

export async function updateStaffRole(id: string, newRole: z.input<typeof role>) {
  return adminAction("staff", async (me) => {
    const r = role.safeParse(newRole);
    if (!r.success) return { ok: false, error: "Invalid role" };
    const user = await db.staffUser.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "Staff member not found" };
    if (user.role === "OWNER" && r.data !== "OWNER" && (await activeOwnerCount(id)) === 0)
      return { ok: false, error: "There must always be at least one active owner." };
    if (id === me.id && r.data !== "OWNER") return { ok: false, error: "You can't remove your own owner role." };
    await db.staffUser.update({ where: { id }, data: { role: r.data } });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Role updated" };
  });
}

export async function setStaffActive(id: string, active: boolean) {
  return adminAction("staff", async (me) => {
    if (id === me.id && !active) return { ok: false, error: "You can't deactivate your own account." };
    const user = await db.staffUser.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "Staff member not found" };
    if (!active && user.role === "OWNER" && (await activeOwnerCount(id)) === 0)
      return { ok: false, error: "There must always be at least one active owner." };
    await db.staffUser.update({ where: { id }, data: { isActive: active } });
    revalidatePath("/admin/staff");
    return { ok: true, message: active ? "Account re-activated" : "Account deactivated – they can no longer log in" };
  });
}

export async function resetStaffPassword(id: string, newPassword: string) {
  return adminAction("staff", async () => {
    const p = password.safeParse(newPassword);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const user = await db.staffUser.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!user) return { ok: false, error: "Staff member not found" };
    await db.staffUser.update({ where: { id }, data: { passwordHash: await bcrypt.hash(p.data, 12) } });
    await db.rateLimit.deleteMany({ where: { key: `login:email:${user.email}` } });
    return { ok: true, message: "Password reset. Share the new password securely." };
  });
}
