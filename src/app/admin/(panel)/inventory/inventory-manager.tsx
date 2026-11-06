"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, History, PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Modal, Drawer } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { adjustStock, discardBatch, getIngredientBatches, getStockHistory, saveIngredient, updateBatchExpiry } from "@/server/actions/admin/inventory";
import { formatDate, formatDateTime } from "@/lib/order-format";
import { EXPIRY_WARNING_DAYS, expiryState } from "@/lib/ingredient-stock";
import { cn } from "@/lib/utils";

type Unit = "KG" | "LITRE" | "PIECE" | "GRAM" | "ML";
type Ing = {
  id: string;
  name: string;
  unit: Unit;
  /** Usable stock (not expired). */
  stock: number;
  expired: number;
  expiringSoon: number;
  nextExpiry: string | null;
  threshold: number;
  updatedAt: string;
  products: { id: string; name: string; isAvailable: boolean }[];
};
type Batch = Awaited<ReturnType<typeof getIngredientBatches>>[number];
type Result = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> };

const UNIT_LABEL: Record<Unit, string> = { KG: "kg", LITRE: "litre", PIECE: "pcs", GRAM: "g", ML: "ml" };
const REASONS = [
  { value: "PURCHASE", label: "Purchase" },
  { value: "USAGE", label: "Usage" },
  { value: "WASTAGE", label: "Wastage" },
  { value: "ADJUSTMENT", label: "Adjustment" },
] as const;
type Reason = (typeof REASONS)[number]["value"];

function status(i: Ing): { label: string; tone: "success" | "warning" | "danger" } {
  if (i.stock <= 0) return { label: "Out", tone: "danger" };
  if (i.stock <= i.threshold) return { label: "Low", tone: "warning" };
  return { label: "In stock", tone: "success" };
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();
/** Today's date in the shop's timezone, as YYYY-MM-DD (for the date picker's minimum). */
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
/** Stored expiry (end of day, IST) → YYYY-MM-DD for a date input. */
const dateKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const st = expiryState(expiresAt);
  if (st === "none") return <Badge tone="neutral">No expiry</Badge>;
  if (st === "expired") return <Badge tone="danger">Expired {formatDate(expiresAt!)}</Badge>;
  if (st === "soon") return <Badge tone="warning">Expires {formatDate(expiresAt!)}</Badge>;
  return <Badge tone="success">Expires {formatDate(expiresAt!)}</Badge>;
}

/** Expiry date picker + "Doesn't expire" tick box, used when stock is added. */
function ExpiryInput({
  id,
  value,
  noExpiry,
  onChange,
  error,
  required,
}: {
  id: string;
  value: string;
  noExpiry: boolean;
  onChange: (v: { expiresOn: string; noExpiry: boolean }) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Field label="Expiry date" htmlFor={id} error={error} required={required && !noExpiry} hint="Stock can be used up to and including this day.">
        <Input
          id={id}
          type="date"
          min={todayKey()}
          value={noExpiry ? "" : value}
          disabled={noExpiry}
          required={required && !noExpiry}
          aria-invalid={!!error}
          onChange={(e) => onChange({ expiresOn: e.target.value, noExpiry })}
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 pl-1 text-sm text-ink-soft">
        <Checkbox checked={noExpiry} onChange={(e) => onChange({ expiresOn: e.target.checked ? "" : value, noExpiry: e.target.checked })} />
        Doesn&apos;t expire (e.g. sugar, salt)
      </label>
    </div>
  );
}

export function InventoryManager({ ingredients }: { ingredients: Ing[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "expiry">("all");
  const [editing, setEditing] = useState<(Partial<Ing> & { expiresOn?: string; noExpiry?: boolean }) | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [adjusting, setAdjusting] = useState<Ing | null>(null);
  const [adj, setAdj] = useState({ direction: "add" as "add" | "reduce", quantity: "", reason: "PURCHASE" as Reason, note: "", expiresOn: "", noExpiry: false, batchId: "" });
  const [adjErrors, setAdjErrors] = useState<Record<string, string>>({});
  const [adjBatches, setAdjBatches] = useState<Batch[] | null>(null);
  const [detailFor, setDetailFor] = useState<Ing | null>(null);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getStockHistory>> | null>(null);
  const [dateEdit, setDateEdit] = useState<{ batchId: string; expiresOn: string; noExpiry: boolean } | null>(null);

  const low = ingredients.filter((i) => i.stock > 0 && i.stock <= i.threshold);
  const out = ingredients.filter((i) => i.stock <= 0);
  const expiry = ingredients.filter((i) => i.expired > 0 || i.expiringSoon > 0);
  const rows = useMemo(
    () =>
      ingredients.filter((i) => {
        if (!i.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
        if (filter === "low") return i.stock > 0 && i.stock <= i.threshold;
        if (filter === "out") return i.stock <= 0;
        if (filter === "expiry") return i.expired > 0 || i.expiringSoon > 0;
        return true;
      }),
    [ingredients, q, filter],
  );

  function done(res: Result, after?: () => void) {
    if (res.ok) {
      toast.success(res.message ?? "Saved");
      after?.();
      router.refresh();
    } else toast.error("Not saved", res.error);
  }

  async function loadDetail(i: Ing) {
    const [b, h] = await Promise.all([getIngredientBatches(i.id), getStockHistory(i.id)]);
    setBatches(b);
    setHistory(h);
  }

  function openDetail(i: Ing) {
    setBatches(null);
    setHistory(null);
    setDateEdit(null);
    setDetailFor(i);
    void loadDetail(i);
  }

  function openAdjust(i: Ing) {
    setAdj({ direction: "add", quantity: "", reason: "PURCHASE", note: "", expiresOn: "", noExpiry: false, batchId: "" });
    setAdjErrors({});
    setAdjBatches(null);
    setAdjusting(i);
    void getIngredientBatches(i.id).then(setAdjBatches);
  }

  return (
    <div className="space-y-5">
      {(out.length > 0 || low.length > 0 || expiry.length > 0) && (
        <div className="rounded-[20px] border border-mango/40 bg-mango-soft p-4">
          <p className="flex flex-wrap items-center gap-2 font-bold text-warning">
            <AlertTriangle className="size-5" aria-hidden /> {out.length} out of stock · {low.length} running low
            {expiry.length > 0 && ` · ${expiry.length} with expired or expiring stock`}
          </p>
          {(out.length > 0 || expiry.length > 0) && (
            <ul className="mt-3 space-y-2">
              {out.map((i) => {
                const affected = i.products.filter((p) => p.isAvailable);
                return (
                  <li key={`out-${i.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 text-sm">
                    <span className="font-bold text-danger">{i.name}</span>
                    <span className="flex-1 text-ink-soft">
                      {affected.length
                        ? `Shown as sold out until you add stock: ${affected.map((p) => p.name).join(", ")}`
                        : "No available drinks use it."}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => openAdjust(i)}>
                      <PackagePlus className="size-4" aria-hidden /> Add stock
                    </Button>
                  </li>
                );
              })}
              {expiry.map((i) => (
                <li key={`exp-${i.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 text-sm">
                  <span className={cn("font-bold", i.expired > 0 ? "text-danger" : "text-warning")}>{i.name}</span>
                  <span className="flex-1 text-ink-soft">
                    {i.expired > 0 && `${fmt(i.expired)} ${UNIT_LABEL[i.unit]} expired (not used for orders)`}
                    {i.expired > 0 && i.expiringSoon > 0 && " · "}
                    {i.expiringSoon > 0 && `${fmt(i.expiringSoon)} ${UNIT_LABEL[i.unit]} expires within ${EXPIRY_WARNING_DAYS} days${i.nextExpiry ? ` (${formatDate(i.nextExpiry)})` : ""}`}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => openDetail(i)}>
                    <CalendarClock className="size-4" aria-hidden /> View batches
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Panel
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditErrors({});
              setEditing({ name: "", unit: "KG", threshold: 0, stock: 0, expiresOn: "", noExpiry: false });
            }}
          >
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
              { value: "expiry", label: `Expiry (${expiry.length})` },
            ]}
            className="md:w-[26rem]"
          />
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">{ingredients.length ? "No ingredients match." : "No ingredients yet – add your first one."}</p>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Ingredient</th>
                  <th className={th}>Usable stock</th>
                  <th className={th}>Low at</th>
                  <th className={th}>Next expiry</th>
                  <th className={th}>Status</th>
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
                        <span className="block text-xs text-ink-muted">
                          Used in {i.products.length} product{i.products.length === 1 ? "" : "s"} · updated {formatDateTime(i.updatedAt)}
                        </span>
                      </td>
                      <td className={`${td} font-bold tabular-nums`}>
                        {fmt(i.stock)} {UNIT_LABEL[i.unit]}
                        {i.expired > 0 && (
                          <span className="block text-xs font-semibold text-danger">
                            + {fmt(i.expired)} {UNIT_LABEL[i.unit]} expired
                          </span>
                        )}
                      </td>
                      <td className={`${td} text-ink-soft tabular-nums`}>
                        {fmt(i.threshold)} {UNIT_LABEL[i.unit]}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {i.nextExpiry ? <ExpiryBadge expiresAt={i.nextExpiry} /> : <span className="text-ink-muted">–</span>}
                      </td>
                      <td className={td}>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <Button size="sm" variant="secondary" onClick={() => openAdjust(i)}>
                          <PackagePlus className="size-4" aria-hidden /> Update stock
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={`Batches and history for ${i.name}`} onClick={() => openDetail(i)}>
                          <History className="size-4" aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${i.name}`}
                          onClick={() => {
                            setEditErrors({});
                            setEditing(i);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {/* Update stock */}
      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`Update stock – ${adjusting?.name ?? ""}`}>
        {adjusting && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setAdjErrors({});
              start(async () => {
                const res: Result = await adjustStock({
                  ingredientId: adjusting.id,
                  direction: adj.direction,
                  quantity: Number(adj.quantity),
                  reason: adj.reason,
                  note: adj.note,
                  expiresOn: adj.expiresOn,
                  noExpiry: adj.noExpiry,
                  batchId: adj.batchId || null,
                });
                if (!res.ok) setAdjErrors(res.fieldErrors ?? {});
                done(res, () => setAdjusting(null));
              });
            }}
          >
            <p className="text-sm text-ink-soft">
              Usable stock: <strong className="text-ink">{fmt(adjusting.stock)} {UNIT_LABEL[adjusting.unit]}</strong>
              {adjusting.expired > 0 && (
                <span className="text-danger">
                  {" "}
                  · {fmt(adjusting.expired)} {UNIT_LABEL[adjusting.unit]} expired
                </span>
              )}
            </p>
            <SegmentedControl
              label="Add or reduce"
              value={adj.direction}
              onChange={(v) => setAdj({ ...adj, direction: v, reason: v === "add" ? "PURCHASE" : "WASTAGE", batchId: "" })}
              options={[
                { value: "add", label: "Add stock" },
                { value: "reduce", label: "Reduce stock" },
              ]}
            />
            <Field label={`Quantity (${UNIT_LABEL[adjusting.unit]})`} htmlFor="adj-qty" required>
              <Input id="adj-qty" type="number" step="0.001" min={0} inputMode="decimal" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} autoFocus />
            </Field>
            {adj.direction === "add" ? (
              <ExpiryInput
                id="adj-exp"
                value={adj.expiresOn}
                noExpiry={adj.noExpiry}
                onChange={(v) => setAdj({ ...adj, ...v })}
                error={adjErrors.expiresOn}
                required
              />
            ) : (
              <Field label="Take from" htmlFor="adj-batch" hint="Auto uses expired stock first, then the earliest expiry.">
                <Select id="adj-batch" value={adj.batchId} onChange={(e) => setAdj({ ...adj, batchId: e.target.value })} disabled={!adjBatches}>
                  <option value="">Auto (expired first, then earliest expiry)</option>
                  {adjBatches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {fmt(b.remaining)} {UNIT_LABEL[adjusting.unit]} ·{" "}
                      {b.expiresAt ? `${expiryState(b.expiresAt) === "expired" ? "expired" : "expires"} ${formatDate(b.expiresAt)}` : "no expiry"}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Reason" htmlFor="adj-reason">
              <Select id="adj-reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value as Reason })}>
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
            <Button
              type="submit"
              className="w-full"
              loading={pending}
              disabled={!(Number(adj.quantity) > 0) || (adj.direction === "add" && !adj.noExpiry && !adj.expiresOn)}
            >
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
              setEditErrors({});
              start(async () => {
                const res: Result = await saveIngredient({
                  id: editing.id,
                  name: editing.name ?? "",
                  unit: (editing.unit ?? "KG") as Unit,
                  lowStockThreshold: Number(editing.threshold) || 0,
                  currentStock: editing.id ? undefined : Number(editing.stock) || 0,
                  expiresOn: editing.expiresOn ?? "",
                  noExpiry: editing.noExpiry ?? false,
                });
                if (!res.ok) setEditErrors(res.fieldErrors ?? {});
                done(res, () => setEditing(null));
              });
            }}
          >
            <Field label="Name" htmlFor="ing-name" error={editErrors.name} required>
              <Input id="ing-name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
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
            <Field label="Low-stock alert at" htmlFor="ing-th" hint="You'll see a warning when usable stock falls to this level.">
              <Input id="ing-th" type="number" step="0.001" min={0} value={editing.threshold ?? 0} onChange={(e) => setEditing({ ...editing, threshold: Number(e.target.value) })} />
            </Field>
            {!editing.id && (
              <>
                <Field label="Opening stock" htmlFor="ing-stock">
                  <Input id="ing-stock" type="number" step="0.001" min={0} value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} />
                </Field>
                <ExpiryInput
                  id="ing-exp"
                  value={editing.expiresOn ?? ""}
                  noExpiry={editing.noExpiry ?? false}
                  onChange={(v) => setEditing({ ...editing, ...v })}
                  error={editErrors.expiresOn}
                  required={(Number(editing.stock) || 0) > 0}
                />
              </>
            )}
            {editing.id && <p className="text-sm text-ink-muted">To add stock with an expiry date, use “Update stock”. Batch dates can be corrected from the batches list.</p>}
            <Button
              type="submit"
              className="w-full"
              loading={pending}
              disabled={!editing.id && (Number(editing.stock) || 0) > 0 && !editing.noExpiry && !editing.expiresOn}
            >
              Save ingredient
            </Button>
          </form>
        )}
      </Modal>

      {/* Batches + history */}
      <Drawer open={!!detailFor} onClose={() => setDetailFor(null)} title={`${detailFor?.name ?? ""} – batches & history`}>
        <h3 className="mb-2 text-sm font-bold tracking-wide text-ink-muted uppercase">Batches in stock</h3>
        {!batches ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-muted">No stock left. Use “Update stock” to add a batch.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {batches.map((b) => {
              const st = expiryState(b.expiresAt);
              const unit = detailFor ? UNIT_LABEL[detailFor.unit] : "";
              return (
                <li key={b.id} className={cn("rounded-2xl border p-3", st === "expired" ? "border-danger/40 bg-danger-soft/40" : "border-line")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold tabular-nums">
                      {fmt(b.remaining)} {unit} <span className="font-normal text-ink-muted">of {fmt(b.received)}</span>
                    </span>
                    <ExpiryBadge expiresAt={b.expiresAt} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Added {formatDateTime(b.receivedAt)}
                    {b.by ? ` · ${b.by}` : ""}
                    {b.note ? ` · ${b.note}` : ""}
                  </p>
                  {dateEdit?.batchId === b.id ? (
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        start(async () =>
                          done(await updateBatchExpiry(dateEdit), () => {
                            setDateEdit(null);
                            if (detailFor) void loadDetail(detailFor);
                          }),
                        );
                      }}
                    >
                      <Field label="Expiry date" htmlFor={`bd-${b.id}`}>
                        <Input
                          id={`bd-${b.id}`}
                          type="date"
                          value={dateEdit.noExpiry ? "" : dateEdit.expiresOn}
                          disabled={dateEdit.noExpiry}
                          onChange={(e) => setDateEdit({ ...dateEdit, expiresOn: e.target.value })}
                          autoFocus
                        />
                      </Field>
                      <label className="flex cursor-pointer items-center gap-2 pl-1 text-sm text-ink-soft">
                        <Checkbox checked={dateEdit.noExpiry} onChange={(e) => setDateEdit({ ...dateEdit, noExpiry: e.target.checked })} />
                        Doesn&apos;t expire
                      </label>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" loading={pending} disabled={!dateEdit.noExpiry && !dateEdit.expiresOn}>
                          Save date
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDateEdit(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDateEdit({ batchId: b.id, expiresOn: b.expiresAt ? dateKey(b.expiresAt) : "", noExpiry: !b.expiresAt })}
                      >
                        <CalendarClock className="size-4" aria-hidden /> Change date
                      </Button>
                      <Button
                        size="sm"
                        variant={st === "expired" ? "danger" : "ghost"}
                        loading={pending}
                        onClick={() =>
                          start(async () =>
                            done(await discardBatch(b.id), () => {
                              if (detailFor) void loadDetail(detailFor);
                            }),
                          )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden /> Discard {fmt(b.remaining)} {unit}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="mt-6 mb-2 text-sm font-bold tracking-wide text-ink-muted uppercase">Stock history</h3>
        {!history ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-muted">No movements yet.</p>
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
                    {h.batchExpiresAt ? ` · batch exp. ${formatDate(h.batchExpiresAt)}` : ""}
                  </span>
                </span>
                <span className={cn("font-bold tabular-nums", h.change >= 0 ? "text-brand-deep" : "text-danger")}>
                  {h.change >= 0 ? "+" : ""}
                  {fmt(h.change)} {detailFor ? UNIT_LABEL[detailFor.unit] : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
