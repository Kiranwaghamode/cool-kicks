"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, History, PackagePlus, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Modal, Drawer } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { adjustStock, getStockHistory, markProductsUsingUnavailable, saveIngredient } from "@/server/actions/admin/inventory";
import { formatDateTime } from "@/lib/order-format";
import { cn } from "@/lib/utils";

type Unit = "KG" | "LITRE" | "PIECE" | "GRAM" | "ML";
type Ing = { id: string; name: string; unit: Unit; stock: number; threshold: number; updatedAt: string; products: { id: string; name: string; isAvailable: boolean }[] };
const UNIT_LABEL: Record<Unit, string> = { KG: "kg", LITRE: "litre", PIECE: "pcs", GRAM: "g", ML: "ml" };
const REASONS = [
  { value: "PURCHASE", label: "Purchase" },
  { value: "USAGE", label: "Usage" },
  { value: "WASTAGE", label: "Wastage" },
  { value: "ADJUSTMENT", label: "Adjustment" },
] as const;

function status(i: Ing): { label: string; tone: "success" | "warning" | "danger" } {
  if (i.stock <= 0) return { label: "Out", tone: "danger" };
  if (i.stock <= i.threshold) return { label: "Low", tone: "warning" };
  return { label: "In stock", tone: "success" };
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function InventoryManager({ ingredients }: { ingredients: Ing[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [editing, setEditing] = useState<Partial<Ing> | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [adjusting, setAdjusting] = useState<Ing | null>(null);
  const [adj, setAdj] = useState({ direction: "add" as "add" | "reduce", quantity: "", reason: "PURCHASE" as (typeof REASONS)[number]["value"], note: "" });
  const [historyFor, setHistoryFor] = useState<Ing | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getStockHistory>> | null>(null);

  const low = ingredients.filter((i) => i.stock > 0 && i.stock <= i.threshold);
  const out = ingredients.filter((i) => i.stock <= 0);
  const rows = useMemo(
    () =>
      ingredients.filter(
        (i) =>
          i.name.toLowerCase().includes(q.trim().toLowerCase()) &&
          (filter === "all" || (filter === "low" ? i.stock > 0 && i.stock <= i.threshold : i.stock <= 0)),
      ),
    [ingredients, q, filter],
  );

  function done(res: { ok: boolean; message?: string; error?: string }, after?: () => void) {
    if (res.ok) {
      toast.success(res.message ?? "Saved");
      after?.();
      router.refresh();
    } else toast.error("Not saved", res.error);
  }

  return (
    <div className="space-y-5">
      {(low.length > 0 || out.length > 0) && (
        <div className="rounded-[20px] border border-mango/40 bg-mango-soft p-4">
          <p className="flex items-center gap-2 font-bold text-warning">
            <AlertTriangle className="size-5" aria-hidden /> {out.length} out of stock · {low.length} running low
          </p>
          {out.length > 0 && (
            <ul className="mt-3 space-y-2">
              {out.map((i) => {
                const affected = i.products.filter((p) => p.isAvailable);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 text-sm">
                    <span className="font-bold text-danger">{i.name}</span>
                    <span className="flex-1 text-ink-soft">
                      {affected.length ? `Used in: ${affected.map((p) => p.name).join(", ")}` : "No available products use it."}
                    </span>
                    {affected.length > 0 && (
                      <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => done(await markProductsUsingUnavailable(i.id)))}>
                        Mark these {affected.length} unavailable
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Panel
        action={
          <Button size="sm" onClick={() => setEditing({ name: "", unit: "KG", threshold: 0, stock: 0 })}>
            <Plus className="size-4" aria-hidden /> Add ingredient
          </Button>
        }
        title={`${ingredients.length} ingredients`}
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <label htmlFor="inv-q" className="sr-only">
              Search ingredients
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input id="inv-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ingredients" className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15" />
          </div>
          <SegmentedControl
            label="Filter"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "low", label: `Low (${low.length})` },
              { value: "out", label: `Out (${out.length})` },
            ]}
            className="md:w-80"
          />
        </div>
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Ingredient</th>
                <th className={th}>Stock</th>
                <th className={th}>Low at</th>
                <th className={th}>Status</th>
                <th className={th}>Updated</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const s = status(i);
                return (
                  <tr key={i.id} className={cn("border-b border-line last:border-0", s.tone === "danger" && "bg-danger-soft/40")}>
                    <td className={td}>
                      <span className="font-semibold">{i.name}</span>
                      <span className="block text-xs text-ink-muted">Used in {i.products.length} product{i.products.length === 1 ? "" : "s"}</span>
                    </td>
                    <td className={`${td} font-bold tabular-nums`}>
                      {fmt(i.stock)} {UNIT_LABEL[i.unit]}
                    </td>
                    <td className={`${td} text-ink-soft tabular-nums`}>
                      {fmt(i.threshold)} {UNIT_LABEL[i.unit]}
                    </td>
                    <td className={td}>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDateTime(i.updatedAt)}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAdj({ direction: "add", quantity: "", reason: "PURCHASE", note: "" });
                          setAdjusting(i);
                        }}
                      >
                        <PackagePlus className="size-4" aria-hidden /> Update stock
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`History for ${i.name}`}
                        onClick={async () => {
                          setHistory(null);
                          setHistoryFor(i);
                          setHistory(await getStockHistory(i.id));
                        }}
                      >
                        <History className="size-4" aria-hidden />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Panel>

      {/* Update stock */}
      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`Update stock – ${adjusting?.name ?? ""}`}>
        {adjusting && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () =>
                done(
                  await adjustStock({ ingredientId: adjusting.id, direction: adj.direction, quantity: Number(adj.quantity), reason: adj.reason, note: adj.note }),
                  () => setAdjusting(null),
                ),
              );
            }}
          >
            <p className="text-sm text-ink-soft">
              Current stock: <strong className="text-ink">{fmt(adjusting.stock)} {UNIT_LABEL[adjusting.unit]}</strong>
            </p>
            <SegmentedControl
              label="Add or reduce"
              value={adj.direction}
              onChange={(v) => setAdj({ ...adj, direction: v, reason: v === "add" ? "PURCHASE" : "WASTAGE" })}
              options={[
                { value: "add", label: "Add stock" },
                { value: "reduce", label: "Reduce stock" },
              ]}
            />
            <Field label={`Quantity (${UNIT_LABEL[adjusting.unit]})`} htmlFor="adj-qty" required>
              <Input id="adj-qty" type="number" step="0.001" min={0} inputMode="decimal" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} autoFocus />
            </Field>
            <Field label="Reason" htmlFor="adj-reason">
              <Select id="adj-reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value as typeof adj.reason })}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="adj-note" hint="Optional – e.g. supplier, bill number">
              <Input id="adj-note" value={adj.note} maxLength={200} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            </Field>
            {adj.quantity && Number(adj.quantity) > 0 && (
              <p className="text-sm text-ink-soft">
                New stock will be{" "}
                <strong className="text-ink">
                  {fmt(adjusting.stock + Number(adj.quantity) * (adj.direction === "add" ? 1 : -1))} {UNIT_LABEL[adjusting.unit]}
                </strong>
              </p>
            )}
            <Button type="submit" className="w-full" loading={pending} disabled={!(Number(adj.quantity) > 0)}>
              Save
            </Button>
          </form>
        )}
      </Modal>

      {/* Add / edit ingredient */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit ingredient" : "Add ingredient"}>
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveIngredient({
                  id: editing.id,
                  name: editing.name ?? "",
                  unit: (editing.unit ?? "KG") as Unit,
                  lowStockThreshold: Number(editing.threshold) || 0,
                  currentStock: editing.id ? undefined : Number(editing.stock) || 0,
                });
                if (!res.ok) setEditErrors(res.fieldErrors ?? {});
                done(res, () => setEditing(null));
              });
            }}
          >
            <Field label="Name" htmlFor="ing-name" error={editErrors.name} required>
              <Input id="ing-name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Unit" htmlFor="ing-unit">
              <Select id="ing-unit" value={editing.unit ?? "KG"} onChange={(e) => setEditing({ ...editing, unit: e.target.value as Unit })}>
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Low-stock alert at" htmlFor="ing-th" hint="You'll see a warning when stock falls to this level.">
              <Input id="ing-th" type="number" step="0.001" min={0} value={editing.threshold ?? 0} onChange={(e) => setEditing({ ...editing, threshold: Number(e.target.value) })} />
            </Field>
            {!editing.id && (
              <Field label="Opening stock" htmlFor="ing-stock">
                <Input id="ing-stock" type="number" step="0.001" min={0} value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} />
              </Field>
            )}
            <Button type="submit" className="w-full" loading={pending}>
              Save ingredient
            </Button>
          </form>
        )}
      </Modal>

      {/* History */}
      <Drawer open={!!historyFor} onClose={() => setHistoryFor(null)} title={`Stock history – ${historyFor?.name ?? ""}`}>
        {!history ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-ink-muted">No movements yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line p-3">
                <span>
                  <span className="font-semibold">{REASONS.find((r) => r.value === h.reason)?.label}</span>
                  {h.note && <span className="text-ink-soft"> · {h.note}</span>}
                  <span className="block text-xs text-ink-muted">
                    {formatDateTime(h.createdAt)}
                    {h.by ? ` · ${h.by}` : ""}
                  </span>
                </span>
                <span className={cn("font-bold tabular-nums", h.change >= 0 ? "text-brand-deep" : "text-danger")}>
                  {h.change >= 0 ? "+" : ""}
                  {fmt(h.change)} {historyFor ? UNIT_LABEL[historyFor.unit] : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
