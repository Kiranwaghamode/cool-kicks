"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileText, KeyRound, MapPin, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StateSelect } from "@/components/ui/state-select";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { GST_STATES } from "@/lib/gst";
import { formatDate } from "@/lib/order-format";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, type DocumentStatus, type DocumentType } from "@/lib/types";
import { changeBusinessPassword, removeBusinessAddress, saveBusinessAddress, uploadBusinessDocument } from "@/server/actions/business/account";

export type PortalAddress = {
  id: string;
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

type Doc = { id: string; type: DocumentType; fileName: string; size: number; status: DocumentStatus; note: string | null; createdAt: string };

type AddressDraft = Omit<PortalAddress, "state" | "id"> & { id?: string; stateCode: string };

const DOC_TONE: Record<DocumentStatus, BadgeTone> = { PENDING: "warning", VERIFIED: "success", REJECTED: "danger" };

function codeForState(name: string, fallback: string) {
  return GST_STATES.find((s) => s.name === name)?.code ?? fallback;
}

export function ProfileView({ addresses, documents, defaultStateCode }: { addresses: PortalAddress[]; documents: Doc[]; defaultStateCode: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<AddressDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docType, setDocType] = useState<DocumentType>("GST_CERTIFICATE");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const blank: AddressDraft = { label: "", contactName: "", phone: "", line1: "", line2: "", landmark: "", area: "", city: "", stateCode: defaultStateCode, pincode: "", isDefault: false };

  function saveAddress(d: AddressDraft) {
    start(async () => {
      const res = await saveBusinessAddress(d);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setDraft(null);
        setErrors({});
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error("Not saved", res.error);
      }
    });
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file first");
    if (file.size > 3 * 1024 * 1024) return toast.error("File is too large", "Max 3 MB");
    const fd = new FormData();
    fd.set("type", docType);
    fd.set("file", file);
    start(async () => {
      const res = await uploadBusinessDocument(fd);
      if (res.ok) {
        toast.success(res.message ?? "Uploaded");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else toast.error("Upload failed", res.error);
    });
  }

  const field = (k: keyof AddressDraft, label: string, opts: { required?: boolean; className?: string; inputMode?: "numeric" | "tel" } = {}) =>
    draft && (
      <Field label={label} htmlFor={`ad-${k}`} error={errors[k]} required={opts.required} className={opts.className}>
        <Input
          id={`ad-${k}`}
          value={draft[k] as string}
          inputMode={opts.inputMode}
          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
          aria-invalid={errors[k] ? true : undefined}
        />
      </Field>
    );

  return (
    <>
      {/* Addresses */}
      <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold">Delivery addresses</h2>
          <Button size="sm" onClick={() => setDraft(blank)}>
            <Plus className="size-4" aria-hidden /> Add address
          </Button>
        </div>
        {addresses.length === 0 ? (
          <EmptyState icon={<MapPin />} title="No addresses yet" description="Add the shops or warehouses we should deliver to." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">
                    {a.label} {a.isDefault && <Badge tone="success">Default</Badge>}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${a.label}`}
                      onClick={() => setDraft({ ...a, stateCode: codeForState(a.state, defaultStateCode) })}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      aria-label={`Remove ${a.label}`}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await removeBusinessAddress(a.id);
                          if (res.ok) {
                            toast.success(res.message ?? "Removed");
                            router.refresh();
                          } else toast.error("Not removed", res.error);
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {[a.line1, a.line2, a.landmark, a.area, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {a.contactName} · {a.phone}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documents */}
      <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6">
        <h2 className="font-bold">Verification documents</h2>
        <p className="mt-1 text-sm text-ink-soft">Only Cool Kick staff can see these. PDF, JPG or PNG up to 3 MB.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
          <Field label="Document type" htmlFor="doc-type">
            <Select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="File" htmlFor="doc-file">
            <input
              ref={fileRef}
              id="doc-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="block h-12 w-full rounded-full border-[1.5px] border-line-strong bg-surface px-2 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-cream file:px-3 file:py-1.5 file:font-semibold"
            />
          </Field>
          <Button onClick={upload} loading={pending} className="h-12">
            <Upload className="size-4" aria-hidden /> Upload
          </Button>
        </div>
        {documents.length > 0 && (
          <ul className="mt-5 divide-y divide-line rounded-2xl border border-line">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <a href={`/business/documents/${d.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 font-semibold hover:text-brand-deep">
                  <FileText className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">
                    {DOCUMENT_TYPE_LABELS[d.type]} · {d.fileName}
                  </span>
                </a>
                <span className="flex items-center gap-2 text-xs text-ink-muted">
                  {formatDate(d.createdAt)} <Badge tone={DOC_TONE[d.status]}>{DOCUMENT_STATUS_LABELS[d.status]}</Badge>
                </span>
                {d.status === "REJECTED" && d.note && <p className="w-full text-sm text-danger">{d.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Password */}
      <section className="rounded-card bg-surface p-5 shadow-warm-soft md:p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <KeyRound className="size-5" aria-hidden /> Change password
        </h2>
        <form
          className="mt-4 grid gap-4 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await changeBusinessPassword(pw);
              if (res.ok) {
                toast.success(res.message ?? "Password changed");
                setPw({ current: "", next: "", confirm: "" });
                setPwErrors({});
              } else {
                setPwErrors(res.fieldErrors ?? {});
                toast.error("Not changed", res.error);
              }
            });
          }}
        >
          <Field label="Current password" htmlFor="pw-current" error={pwErrors.current}>
            <Input id="pw-current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="New password" htmlFor="pw-next" error={pwErrors.next}>
            <Input id="pw-next" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm" error={pwErrors.confirm}>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <div className="md:col-span-3">
            <Button type="submit" variant="dark" loading={pending}>
              Update password
            </Button>
          </div>
        </form>
      </section>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit address" : "New address"}>
        {draft && (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveAddress(draft);
            }}
          >
            {field("label", "Address name", { required: true, className: "sm:col-span-2" })}
            {field("contactName", "Receiver name", { required: true })}
            {field("phone", "Receiver mobile", { required: true, inputMode: "tel" })}
            {field("line1", "Shop / building and street", { required: true, className: "sm:col-span-2" })}
            {field("line2", "Address line 2", { className: "sm:col-span-2" })}
            {field("area", "Area", { required: true })}
            {field("landmark", "Landmark")}
            {field("city", "City", { required: true })}
            {field("pincode", "Pincode", { required: true, inputMode: "numeric" })}
            <Field label="State" htmlFor="ad-state" error={errors.stateCode} className="sm:col-span-2">
              <StateSelect id="ad-state" value={draft.stateCode} onChange={(e) => setDraft({ ...draft, stateCode: e.target.value })} />
            </Field>
            <label className="flex items-center gap-3 font-semibold sm:col-span-2">
              <Checkbox checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} /> Use as default delivery address
            </label>
            <Button type="submit" className="sm:col-span-2" loading={pending}>
              Save address
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
