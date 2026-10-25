"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPinned, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { saveZone, setZoneActive } from "@/server/actions/admin/config";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { cn } from "@/lib/utils";

type Zone = { id: string; name: string; pincodes: string[]; deliveryFee: number; freeDeliveryAbove: number | null; isActive: boolean; orders: number };
type Draft = { id?: string; name: string; pincodes: string; fee: string; free: string; isActive: boolean };

export function ZoneManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Panel
      title={`${zones.length} zones`}
      action={
        <Button size="sm" onClick={() => setDraft({ name: "", pincodes: "", fee: "30", free: "", isActive: true })}>
          <Plus className="size-4" aria-hidden /> New zone
        </Button>
      }
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {zones.map((z) => (
          <li key={z.id} className={cn("rounded-2xl border border-line p-5", !z.isActive && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-bold">
                  <MapPinned className="size-4 text-brand-deep" aria-hidden /> {z.name}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Fee {formatPaise(z.deliveryFee)}
                  {z.freeDeliveryAbove ? ` · free above ${formatPaise(z.freeDeliveryAbove)}` : " · no free delivery"}
                </p>
                <p className="text-xs text-ink-muted">{z.orders} orders delivered here</p>
              </div>
              <Switch
                checked={z.isActive}
                label={`${z.name} active`}
                onChange={(v) =>
                  start(async () => {
                    const res = await setZoneActive(z.id, v);
                    if (res.ok) {
                      toast.success(res.message ?? "Saved");
                      router.refresh();
                    } else toast.error("Not saved", res.error);
                  })
                }
              />
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {z.pincodes.map((p) => (
                <li key={p} className="rounded-full bg-cream px-2.5 py-0.5 font-mono text-xs font-semibold">
                  {p}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() =>
                setDraft({
                  id: z.id,
                  name: z.name,
                  pincodes: z.pincodes.join(", "),
                  fee: String(paiseToRupees(z.deliveryFee)),
                  free: z.freeDeliveryAbove ? String(paiseToRupees(z.freeDeliveryAbove)) : "",
                  isActive: z.isActive,
                })
              }
            >
              <Pencil className="size-4" aria-hidden /> Edit
            </Button>
          </li>
        ))}
      </ul>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit zone" : "New delivery zone"}>
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveZone({
                  id: draft.id,
                  name: draft.name,
                  pincodes: draft.pincodes.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean),
                  deliveryFee: rupeesToPaise(Number(draft.fee) || 0),
                  freeDeliveryAbove: draft.free ? rupeesToPaise(Number(draft.free)) : null,
                  isActive: draft.isActive,
                });
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
            }}
          >
            <Field label="Zone name" htmlFor="z-name" error={errors.name} required>
              <Input id="z-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nearby (within 3 km)" />
            </Field>
            <Field label="Pincodes" htmlFor="z-pins" error={errors.pincodes ?? Object.entries(errors).find(([k]) => k.startsWith("pincodes."))?.[1]} hint="Separate with commas or spaces" required>
              <Textarea id="z-pins" value={draft.pincodes} onChange={(e) => setDraft({ ...draft, pincodes: e.target.value })} placeholder="411004, 411005, 411016" className="font-mono" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery fee (₹)" htmlFor="z-fee" error={errors.deliveryFee}>
                <Input id="z-fee" type="number" min={0} value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} />
              </Field>
              <Field label="Free delivery above (₹)" htmlFor="z-free" hint="Empty = never free">
                <Input id="z-free" type="number" min={0} value={draft.free} onChange={(e) => setDraft({ ...draft, free: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center justify-between font-semibold">
              Active
              <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Zone active" />
            </label>
            <Button type="submit" className="w-full" loading={pending}>
              Save zone
            </Button>
          </form>
        )}
      </Modal>
    </Panel>
  );
}
