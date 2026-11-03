"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { saveCreditAccount } from "@/server/actions/admin/businesses";

type Summary = { isActive: boolean; limit: number; days: number; outstanding: number; overdue: number; overdueCount: number; available: number };

export function CreditPanel({ businessId, summary, note, canEdit }: { businessId: string; summary: Summary; note: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ isActive: summary.isActive, limit: String(paiseToRupees(summary.limit)), days: String(summary.days), note });
  const usedPct = summary.limit ? Math.min(100, Math.round((summary.outstanding / summary.limit) * 100)) : 0;

  return (
    <Panel
      title="Credit"
      action={
        canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Pencil className="size-4" aria-hidden /> Edit
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-muted">Status</dt>
          <dd className={summary.isActive ? "font-bold text-brand-deep" : "font-bold text-ink-soft"}>{summary.isActive ? "Credit on" : "Advance only"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Terms</dt>
          <dd className="font-bold">{summary.days} days</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Limit</dt>
          <dd className="font-bold tabular-nums">{formatPaise(summary.limit)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Available</dt>
          <dd className="font-bold tabular-nums">{formatPaise(summary.available)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Outstanding</dt>
          <dd className="font-bold tabular-nums">{formatPaise(summary.outstanding)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Overdue</dt>
          <dd className={summary.overdue ? "font-bold text-danger tabular-nums" : "font-bold tabular-nums"}>
            {formatPaise(summary.overdue)}
            {summary.overdueCount > 0 && <span className="block text-xs font-medium">{summary.overdueCount} invoice(s)</span>}
          </dd>
        </div>
      </dl>
      {summary.limit > 0 && (
        <div className="mt-4" aria-label={`${usedPct}% of credit limit used`}>
          <div className="h-2 overflow-hidden rounded-full bg-cream">
            <div className={`h-full rounded-full ${usedPct >= 90 ? "bg-danger" : usedPct >= 70 ? "bg-tangerine" : "bg-brand"}`} style={{ width: `${usedPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-muted">{usedPct}% of limit used</p>
        </div>
      )}
      {note && <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2 text-sm text-ink-soft">{note}</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="Credit terms">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveCreditAccount({
                businessId,
                isActive: draft.isActive,
                creditLimit: rupeesToPaise(Number(draft.limit) || 0),
                creditDays: Math.round(Number(draft.days) || 0),
                note: draft.note,
              });
              if (res.ok) {
                toast.success(res.message ?? "Saved");
                setOpen(false);
                router.refresh();
              } else toast.error("Not saved", res.error);
            });
          }}
        >
          <label className="flex items-center justify-between font-semibold">
            Allow ordering on credit
            <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Allow credit" />
          </label>
          <Field label="Credit limit (₹)" htmlFor="cr-limit" hint="Orders that would take the unpaid balance above this are blocked">
            <Input id="cr-limit" type="number" min={0} step="1" value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} />
          </Field>
          <Field label="Payment terms (days)" htmlFor="cr-days" hint="Invoice due date = invoice date + these days">
            <Input id="cr-days" type="number" min={0} max={180} value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} />
          </Field>
          <Field label="Internal note" htmlFor="cr-note">
            <Textarea id="cr-note" maxLength={300} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </Field>
          <Button type="submit" loading={pending}>
            Save credit terms
          </Button>
        </form>
      </Modal>
    </Panel>
  );
}
