"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { th, td, TableWrap } from "@/components/admin/ui";
import { createStaff, resetStaffPassword, setStaffActive, updateStaffRole } from "@/server/actions/admin/staff";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/order-format";
import type { Role } from "@/lib/types";

type Staff = { id: string; name: string; email: string; role: Role; isActive: boolean; lastLoginAt: string | null };

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function StaffManager({ staff, meId }: { staff: Staff[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<Staff | null>(null);
  const [newPass, setNewPass] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function run(p: Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await p;
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error("Not saved", res.error);
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <UserPlus className="size-4" aria-hidden /> Add staff
        </Button>
      </div>
      <TableWrap>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>Name</th>
              <th className={th}>Role</th>
              <th className={th}>Last login</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className={td}>
                  <span className="font-semibold">{s.name}</span>
                  {s.id === meId && <Badge tone="neutral" className="ml-2">You</Badge>}
                  <span className="block text-xs text-ink-muted">{s.email}</span>
                </td>
                <td className={td}>
                  <label className="sr-only" htmlFor={`role-${s.id}`}>
                    Role for {s.name}
                  </label>
                  <select
                    id={`role-${s.id}`}
                    value={s.role}
                    disabled={pending || s.id === meId}
                    onChange={(e) => run(updateStaffRole(s.id, e.target.value as Role))}
                    className="h-9 rounded-full border border-line-strong bg-surface px-3 text-sm font-semibold"
                  >
                    {(["OWNER", "MANAGER", "STAFF"] as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${td} text-ink-soft`}>{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "Never"}</td>
                <td className={td}>{s.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>}</td>
                <td className={`${td} text-right whitespace-nowrap`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setResetFor(s);
                      setNewPass(randomPassword());
                    }}
                  >
                    <KeyRound className="size-4" aria-hidden /> Reset password
                  </Button>
                  {s.id !== meId && (
                    <Button size="sm" variant={s.isActive ? "outline" : "secondary"} disabled={pending} onClick={() => run(setStaffActive(s.id, !s.isActive))}>
                      {s.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add staff member">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await createStaff({
                name: String(fd.get("name")),
                email: String(fd.get("email")),
                role: String(fd.get("role")) as Role,
                password: String(fd.get("password")),
              });
              if (res.ok) {
                toast.success(res.message ?? "Added");
                setAdding(false);
                setErrors({});
                router.refresh();
              } else {
                setErrors(res.fieldErrors ?? {});
                toast.error("Not added", res.error);
              }
            });
          }}
        >
          <Field label="Name" htmlFor="s-name" error={errors.name} required>
            <Input id="s-name" name="name" required />
          </Field>
          <Field label="Email" htmlFor="s-email" error={errors.email} required>
            <Input id="s-email" name="email" type="email" required />
          </Field>
          <Field label="Role" htmlFor="s-role">
            <Select id="s-role" name="role" defaultValue="STAFF">
              <option value="STAFF">Staff – orders only</option>
              <option value="MANAGER">Manager – products, inventory, coupons, reports</option>
              <option value="OWNER">Owner – everything</option>
            </Select>
          </Field>
          <Field label="Temporary password" htmlFor="s-password" error={errors.password} hint="At least 8 characters. Share it securely." required>
            <Input id="s-password" name="password" defaultValue={adding ? randomPassword() : ""} required minLength={8} />
          </Field>
          <Button type="submit" className="w-full" loading={pending}>
            Add staff member
          </Button>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password – ${resetFor?.name ?? ""}`}>
        <div className="space-y-4">
          <Field label="New password" htmlFor="s-newpass" hint="Copy this and share it securely with the staff member.">
            <Input id="s-newpass" value={newPass} onChange={(e) => setNewPass(e.target.value)} minLength={8} />
          </Field>
          <Button
            className="w-full"
            loading={pending}
            onClick={() => {
              if (!resetFor) return;
              const id = resetFor.id;
              start(async () => {
                const res = await resetStaffPassword(id, newPass);
                if (res.ok) {
                  toast.success(res.message ?? "Password reset");
                  setResetFor(null);
                } else toast.error("Not reset", res.error);
              });
            }}
          >
            Set new password
          </Button>
        </div>
      </Modal>
    </>
  );
}
