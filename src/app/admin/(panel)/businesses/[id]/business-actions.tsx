"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, CheckCircle2, KeyRound, Pencil, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StateSelect } from "@/components/ui/state-select";
import { toast } from "@/components/ui/toast";
import { CopyButton } from "@/components/shop/copy-button";
import { resetBusinessPassword, reviewDocument, setBusinessStatus, updateBusiness, type BusinessUpdateInput } from "@/server/actions/admin/businesses";
import type { BusinessStatus, BusinessType } from "@/lib/types";

type Business = Omit<BusinessUpdateInput, "type"> & { id: string; status: BusinessStatus; type: BusinessType; groupId: string };

export function BusinessActions({ business, groups }: { business: Business; groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<null | "approve" | "reject" | "suspend" | "edit" | "password">(null);
  const [note, setNote] = useState("");
  const [groupId, setGroupId] = useState(business.groupId);
  const [draft, setDraft] = useState<Business>(business);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function run(p: () => Promise<{ ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }>, after?: () => void) {
    start(async () => {
      const res = await p();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setMode(null);
        after?.();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error("Not saved", res.error);
      }
    });
  }

  const s = business.status;
  return (
    <>
      {s === "PENDING" && (
        <>
          <Button onClick={() => setMode("approve")}>
            <CheckCircle2 className="size-4" aria-hidden /> Approve
          </Button>
          <Button variant="outline" className="text-danger" onClick={() => { setNote(""); setMode("reject"); }}>
            <Ban className="size-4" aria-hidden /> Reject
          </Button>
        </>
      )}
      {s === "APPROVED" && (
        <Button variant="outline" className="text-danger" onClick={() => { setNote(""); setMode("suspend"); }}>
          <Ban className="size-4" aria-hidden /> Suspend
        </Button>
      )}
      {(s === "SUSPENDED" || s === "REJECTED") && (
        <Button onClick={() => setMode("approve")}>
          <RotateCcw className="size-4" aria-hidden /> {s === "SUSPENDED" ? "Reactivate" : "Approve"}
        </Button>
      )}
      <Button variant="outline" onClick={() => { setDraft(business); setErrors({}); setMode("edit"); }}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <Button variant="ghost" onClick={() => { setTempPassword(null); setMode("password"); }}>
        <KeyRound className="size-4" aria-hidden /> Reset password
      </Button>

      <Modal
        open={mode === "approve"}
        onClose={() => setMode(null)}
        title={s === "SUSPENDED" ? "Reactivate business" : "Approve business"}
        footer={
          <Button className="w-full" loading={pending} onClick={() => run(() => setBusinessStatus({ id: business.id, status: "APPROVED", groupId }))}>
            <Check className="size-4" aria-hidden /> Confirm
          </Button>
        }
      >
        <p className="text-sm text-ink-soft">The business will see wholesale prices and can start ordering. Set credit terms separately.</p>
        <Field label="Customer group" htmlFor="ap-group" className="mt-4" hint="Decides which price list applies">
          <Select id="ap-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Automatic (by business type)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={mode === "reject" || mode === "suspend"}
        onClose={() => setMode(null)}
        title={mode === "reject" ? "Reject application" : "Suspend business"}
        footer={
          <Button
            variant="danger"
            className="w-full"
            loading={pending}
            onClick={() => run(() => setBusinessStatus({ id: business.id, status: mode === "reject" ? "REJECTED" : "SUSPENDED", note }))}
          >
            {mode === "reject" ? "Reject" : "Suspend"}
          </Button>
        }
      >
        <label htmlFor="biz-note" className="mb-1.5 block text-sm font-semibold">
          Reason <span className="font-normal text-ink-muted">(shown to the business)</span>
        </label>
        <Textarea id="biz-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="E.g. GST certificate doesn't match the business name" />
        {mode === "suspend" && <p className="mt-2 text-xs text-ink-muted">Suspended businesses can log in but can&apos;t see prices or place orders. Existing orders are not affected.</p>}
      </Modal>

      <Modal open={mode === "edit"} onClose={() => setMode(null)} title="Edit business">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateBusiness(draft));
          }}
        >
          {(
            [
              ["legalName", "Registered name", "sm:col-span-2"],
              ["tradeName", "Trade name", "sm:col-span-2"],
              ["contactName", "Contact name", ""],
              ["phone", "Mobile (login)", ""],
              ["email", "Email", "sm:col-span-2"],
              ["gstin", "GSTIN", ""],
              ["pan", "PAN", ""],
            ] as const
          ).map(([k, label, cls]) => (
            <Field key={k} label={label} htmlFor={`be-${k}`} error={errors[k]} className={cls}>
              <Input id={`be-${k}`} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
            </Field>
          ))}
          <Field label="Type" htmlFor="be-type">
            <Select id="be-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as BusinessType })}>
              <option value="RETAILER">Retailer</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </Select>
          </Field>
          <Field label="State" htmlFor="be-state" error={errors.stateCode}>
            <StateSelect id="be-state" value={draft.stateCode} onChange={(e) => setDraft({ ...draft, stateCode: e.target.value })} />
          </Field>
          <Field label="Customer group" htmlFor="be-group" className="sm:col-span-2">
            <Select id="be-group" value={draft.groupId} onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}>
              <option value="">None (base wholesale prices)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" className="sm:col-span-2" loading={pending}>
            Save details
          </Button>
        </form>
      </Modal>

      <Modal open={mode === "password"} onClose={() => setMode(null)} title="Reset password">
        {tempPassword ? (
          <div>
            <p className="text-sm text-ink-soft">Share this temporary password with the business. It is shown only once; they should change it from their profile.</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-cream-50 p-4">
              <span className="font-mono text-xl font-bold tracking-wider">{tempPassword}</span>
              <CopyButton value={tempPassword} label="Copy password" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft">This creates a new temporary password and signs the business out of all devices.</p>
            <Button
              className="mt-4 w-full"
              variant="dark"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await resetBusinessPassword(business.id);
                  if (res.ok && res.data) setTempPassword(res.data.password);
                  else if (!res.ok) toast.error("Not reset", res.error);
                })
              }
            >
              Create temporary password
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}

export function DocumentReview({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const run = (status: "VERIFIED" | "REJECTED") =>
    start(async () => {
      const res = await reviewDocument({ id, status, note });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setRejecting(false);
        router.refresh();
      } else toast.error("Not saved", res.error);
    });
  return (
    <>
      <Button size="sm" variant="secondary" loading={pending} onClick={() => run("VERIFIED")}>
        <Check className="size-4" aria-hidden /> Verify
      </Button>
      <Button size="sm" variant="ghost" className="text-danger" aria-label="Reject document" onClick={() => setRejecting(true)}>
        <X className="size-4" aria-hidden />
      </Button>
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject document"
        footer={
          <Button variant="danger" className="w-full" loading={pending} onClick={() => run("REJECTED")}>
            Reject document
          </Button>
        }
      >
        <label htmlFor={`doc-note-${id}`} className="mb-1.5 block text-sm font-semibold">
          Reason (shown to the business)
        </label>
        <Input id={`doc-note-${id}`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="E.g. Image is blurry – please upload a clearer copy" />
      </Modal>
    </>
  );
}
