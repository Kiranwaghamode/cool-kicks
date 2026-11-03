"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PackagePlus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { formatDate } from "@/lib/order-format";
import { adjustBatch, createBatch, writeOffExpired } from "@/server/actions/admin/batches";
import { cn } from "@/lib/utils";

type Variant = { id: string; label: string; hasRecipe: boolean };
type Batch = {
  id: string;
  batchNumber: string;
  product: string;
  manufacturedAt: string;
  expiresAt: string;
  produced: number;
  remaining: number;
  costPerUnit: number | null;
  state: "ok" | "expiring" | "expired";
};

type Result = { ok: boolean; message?: string; error?: string };

export function FinishedStockManager({ variants, batches, today, show }: { variants: Variant[]; batches: Batch[]; today: string; show: "active" | "all" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState<Batch | null>(null);
  const plusDays = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ variantId: variants[0]?.id ?? "", batchNumber: "", manufacturedAt: today, expiresAt: plusDays(7), quantity: "", cost: "", deduct: true, note: "" });
  const [adj, setAdj] = useState({ mode: "WASTAGE" as "WASTAGE" | "ADJUSTMENT", qty: "", note: "" });

  const run = (p: () => Promise<Result>, done?: () => void) =>
    start(async () => {
      const res = await p();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        done?.();
        router.refresh();
      } else toast.error("Not saved", res.error);
    });

  const selected = variants.find((v) => v.id === form.variantId);
  const expiredCount = batches.filter((b) => b.state === "expired" && b.remaining > 0).length;

  return (
    <Panel
      title="Batches"
      action={
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/finished-stock?show=${show === "all" ? "active" : "all"}`} className="self-center text-sm font-semibold text-brand-deep underline">
            {show === "all" ? "Hide empty batches" : "Show empty batches"}
          </Link>
          {expiredCount > 0 && (
            <Button size="sm" variant="outline" className="text-danger" loading={pending} onClick={() => run(() => writeOffExpired())}>
              <Trash2 className="size-4" aria-hidden /> Write off expired
            </Button>
          )}
          <Button size="sm" onClick={() => setCreating(true)} disabled={!variants.length}>
            <PackagePlus className="size-4" aria-hidden /> Add batch
          </Button>
        </div>
      }
    >
      {batches.length === 0 ? (
        <EmptyState
          icon={<PackagePlus />}
          title="No finished stock yet"
          description={variants.length ? "Add a production batch so wholesale orders can be confirmed." : "Turn on wholesale for products first (Products → edit → Wholesale)."}
        />
      ) : (
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Batch</th>
                <th className={th}>Product</th>
                <th className={th}>Made</th>
                <th className={th}>Expires</th>
                <th className={th}>Remaining</th>
                <th className={th}>Cost / unit</th>
                <th className={th}>
                  <span className="sr-only">Adjust</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className={cn("border-b border-line last:border-0", b.remaining === 0 && "opacity-50")}>
                  <td className={`${td} font-mono font-bold`}>{b.batchNumber}</td>
                  <td className={`${td} font-semibold`}>{b.product}</td>
                  <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDate(b.manufacturedAt)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {formatDate(b.expiresAt)}{" "}
                    {b.state !== "ok" && b.remaining > 0 && <Badge tone={b.state === "expired" ? "danger" : "warning"}>{b.state === "expired" ? "Expired" : "Expiring"}</Badge>}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    <span className="font-bold">{b.remaining}</span> <span className="text-ink-muted">/ {b.produced}</span>
                  </td>
                  <td className={`${td} tabular-nums text-ink-soft`}>{b.costPerUnit !== null ? formatPaise(b.costPerUnit) : "—"}</td>
                  <td className={`${td} text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => { setAdj({ mode: b.state === "expired" ? "WASTAGE" : "WASTAGE", qty: b.state === "expired" ? String(b.remaining) : "", note: b.state === "expired" ? "Expired" : "" }); setAdjusting(b); }}>
                      <SlidersHorizontal className="size-4" aria-hidden /> Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Add production batch">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                createBatch({
                  variantId: form.variantId,
                  batchNumber: form.batchNumber,
                  manufacturedAt: form.manufacturedAt,
                  expiresAt: form.expiresAt,
                  quantity: Math.round(Number(form.quantity) || 0),
                  costPerUnit: form.cost ? rupeesToPaise(Number(form.cost) || 0) : null,
                  deductIngredients: form.deduct && !!selected?.hasRecipe,
                  note: form.note,
                }),
              () => {
                setCreating(false);
                setForm((f) => ({ ...f, batchNumber: "", quantity: "", note: "" }));
              },
            );
          }}
        >
          <Field label="Product" htmlFor="bt-variant" className="sm:col-span-2">
            <Select id="bt-variant" value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Units produced" htmlFor="bt-qty">
            <Input id="bt-qty" type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Batch number" htmlFor="bt-no" hint="Leave empty to number it automatically">
            <Input id="bt-no" value={form.batchNumber} maxLength={30} className="font-mono uppercase" onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
          </Field>
          <Field label="Made on" htmlFor="bt-mfg">
            <Input id="bt-mfg" type="date" max={today} value={form.manufacturedAt} onChange={(e) => setForm({ ...form, manufacturedAt: e.target.value })} />
          </Field>
          <Field label="Best before" htmlFor="bt-exp">
            <Input id="bt-exp" type="date" min={form.manufacturedAt} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </Field>
          <Field label="Cost per unit (₹)" htmlFor="bt-cost" hint="Optional – used for estimated margins" className="sm:col-span-2">
            <Input id="bt-cost" type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </Field>
          <label className={cn("flex items-center gap-3 text-sm font-semibold sm:col-span-2", !selected?.hasRecipe && "opacity-50")}>
            <Checkbox checked={form.deduct && !!selected?.hasRecipe} disabled={!selected?.hasRecipe} onChange={(e) => setForm({ ...form, deduct: e.target.checked })} />
            {selected?.hasRecipe ? "Use up recipe ingredients from inventory" : "This product has no recipe – ingredients won't be deducted"}
          </label>
          <Field label="Note" htmlFor="bt-note" className="sm:col-span-2">
            <Input id="bt-note" value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <Button type="submit" className="sm:col-span-2" loading={pending}>
            Add batch
          </Button>
        </form>
      </Modal>

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={adjusting ? `Adjust ${adjusting.batchNumber}` : "Adjust"}>
        {adjusting && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Math.round(Number(adj.qty) || 0);
              run(() => adjustBatch({ batchId: adjusting.id, change: adj.mode === "WASTAGE" ? -Math.abs(n) : n, reason: adj.mode, note: adj.note }), () => setAdjusting(null));
            }}
          >
            <p className="text-sm text-ink-soft">
              {adjusting.product} · {adjusting.remaining} units left
            </p>
            <Field label="Type" htmlFor="adj-mode">
              <Select id="adj-mode" value={adj.mode} onChange={(e) => setAdj({ ...adj, mode: e.target.value as "WASTAGE" | "ADJUSTMENT" })}>
                <option value="WASTAGE">Write off (wastage / expired / damaged)</option>
                <option value="ADJUSTMENT">Stock count correction (+ or −)</option>
              </Select>
            </Field>
            <Field label={adj.mode === "WASTAGE" ? "Units to write off" : "Change (e.g. -3 or 5)"} htmlFor="adj-qty">
              <Input id="adj-qty" type="number" required value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} />
            </Field>
            <Field label="Note" htmlFor="adj-note">
              <Input id="adj-note" required minLength={3} maxLength={200} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            </Field>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </form>
        )}
      </Modal>
    </Panel>
  );
}
