"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListChecks, Pencil, Plus, Tags, Users } from "lucide-react";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { saveCustomerGroup, savePriceList, savePriceListItems } from "@/server/actions/admin/pricing";

type Group = { id: string; name: string; description: string; priceListId: string; isActive: boolean; businessCount: number };
type List = { id: string; name: string; description: string; discountBps: number; isActive: boolean; groupCount: number; items: Record<string, number> };
type Variant = { id: string; label: string; basePrice: number | null };

type Result = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> };

export function PricingManager({ groups, lists, variants }: { groups: Group[]; lists: List[]; variants: Variant[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [group, setGroup] = useState<Partial<Group> | null>(null);
  const [list, setList] = useState<(Omit<Partial<List>, "discountBps"> & { pct: string }) | null>(null);
  const [itemsFor, setItemsFor] = useState<List | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function run(p: () => Promise<Result>, done: () => void) {
    start(async () => {
      const res = await p();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setErrors({});
        done();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error("Not saved", res.error);
      }
    });
  }

  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? "Base wholesale prices";

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Users className="size-5" aria-hidden /> Customer groups
          </span>
        }
        action={
          <Button size="sm" onClick={() => setGroup({ name: "", description: "", priceListId: "", isActive: true })}>
            <Plus className="size-4" aria-hidden /> New group
          </Button>
        }
      >
        {groups.length === 0 ? (
          <EmptyState title="No groups yet" description="Create groups like Retailers and Distributors." />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Group</th>
                  <th className={th}>Price list</th>
                  <th className={th}>Businesses</th>
                  <th className={th}>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className={td}>
                      <span className="font-bold">{g.name}</span> {!g.isActive && <Badge tone="neutral">Inactive</Badge>}
                      {g.description && <span className="block text-xs text-ink-muted">{g.description}</span>}
                    </td>
                    <td className={td}>{listName(g.priceListId)}</td>
                    <td className={`${td} tabular-nums`}>{g.businessCount}</td>
                    <td className={`${td} text-right`}>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${g.name}`} onClick={() => setGroup(g)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel
        title={
          <span className="flex items-center gap-2">
            <Tags className="size-5" aria-hidden /> Price lists
          </span>
        }
        action={
          <Button size="sm" onClick={() => setList({ name: "", description: "", pct: "0", isActive: true })}>
            <Plus className="size-4" aria-hidden /> New price list
          </Button>
        }
      >
        {lists.length === 0 ? (
          <EmptyState title="No price lists yet" description="Without a price list, businesses pay the base wholesale price." />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Price list</th>
                  <th className={th}>Discount</th>
                  <th className={th}>Overrides</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lists.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className={td}>
                      <span className="font-bold">{l.name}</span> {!l.isActive && <Badge tone="neutral">Inactive</Badge>}
                      <span className="block text-xs text-ink-muted">Used by {l.groupCount} group(s)</span>
                    </td>
                    <td className={`${td} tabular-nums`}>{l.discountBps / 100}% off base</td>
                    <td className={`${td} tabular-nums`}>{Object.keys(l.items).length}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setItemsFor(l);
                          setOverrides(Object.fromEntries(Object.entries(l.items).map(([k, v]) => [k, String(paiseToRupees(v))])));
                        }}
                      >
                        <ListChecks className="size-4" aria-hidden /> Prices
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${l.name}`} onClick={() => setList({ ...l, pct: String(l.discountBps / 100) })}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Modal open={!!group} onClose={() => setGroup(null)} title={group?.id ? `Edit ${group.name}` : "New customer group"}>
        {group && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => saveCustomerGroup({ id: group.id, name: group.name ?? "", description: group.description ?? "", priceListId: group.priceListId ?? "", isActive: group.isActive ?? true }),
                () => setGroup(null),
              );
            }}
          >
            <Field label="Name" htmlFor="g-name" error={errors.name}>
              <Input id="g-name" value={group.name ?? ""} onChange={(e) => setGroup({ ...group, name: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="g-desc">
              <Input id="g-desc" value={group.description ?? ""} onChange={(e) => setGroup({ ...group, description: e.target.value })} />
            </Field>
            <Field label="Price list" htmlFor="g-list">
              <Select id="g-list" value={group.priceListId ?? ""} onChange={(e) => setGroup({ ...group, priceListId: e.target.value })}>
                <option value="">Base wholesale prices</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center justify-between font-semibold">
              Active
              <Switch checked={group.isActive ?? true} onChange={(v) => setGroup({ ...group, isActive: v })} label="Group active" />
            </label>
            <Button type="submit" loading={pending}>
              Save group
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={!!list} onClose={() => setList(null)} title={list?.id ? `Edit ${list.name}` : "New price list"}>
        {list && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => savePriceList({ id: list.id, name: list.name ?? "", description: list.description ?? "", discountBps: Math.round((Number(list.pct) || 0) * 100), isActive: list.isActive ?? true }),
                () => setList(null),
              );
            }}
          >
            <Field label="Name" htmlFor="pl-name" error={errors.name}>
              <Input id="pl-name" value={list.name ?? ""} onChange={(e) => setList({ ...list, name: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="pl-desc">
              <Input id="pl-desc" value={list.description ?? ""} onChange={(e) => setList({ ...list, description: e.target.value })} />
            </Field>
            <Field label="Discount off base wholesale price (%)" htmlFor="pl-pct" error={errors.discountBps} hint="Applies to every product without an override">
              <Input id="pl-pct" type="number" min={0} max={90} step="0.01" value={list.pct} onChange={(e) => setList({ ...list, pct: e.target.value })} />
            </Field>
            <label className="flex items-center justify-between font-semibold">
              Active
              <Switch checked={list.isActive ?? true} onChange={(v) => setList({ ...list, isActive: v })} label="Price list active" />
            </label>
            <Button type="submit" loading={pending}>
              Save price list
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={!!itemsFor} onClose={() => setItemsFor(null)} title={itemsFor ? `Prices in ${itemsFor.name}` : "Prices"} className="max-w-2xl">
        {itemsFor &&
          (variants.length === 0 ? (
            <EmptyState title="No wholesale products" description="Turn on wholesale for products first (Products → edit → Wholesale)." />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    savePriceListItems({
                      priceListId: itemsFor.id,
                      items: variants.map((v) => ({ variantId: v.id, price: overrides[v.id] ? rupeesToPaise(Number(overrides[v.id]) || 0) || null : null })),
                    }),
                  () => setItemsFor(null),
                );
              }}
            >
              <p className="mb-3 text-sm text-ink-soft">Leave a price empty to use {itemsFor.discountBps / 100}% off the base price. Prices exclude GST.</p>
              <TableWrap>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className={th}>Product</th>
                      <th className={th}>Base</th>
                      <th className={th}>List price</th>
                      <th className={th}>Override (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id} className="border-b border-line last:border-0">
                        <td className={`${td} font-semibold`}>{v.label}</td>
                        <td className={`${td} tabular-nums text-ink-muted`}>{v.basePrice !== null ? formatPaise(v.basePrice) : "—"}</td>
                        <td className={`${td} tabular-nums`}>{v.basePrice !== null ? formatPaise(Math.round((v.basePrice * (10000 - itemsFor.discountBps)) / 10000)) : "—"}</td>
                        <td className={td}>
                          <label htmlFor={`ov-${v.id}`} className="sr-only">
                            Override price for {v.label}
                          </label>
                          <Input
                            id={`ov-${v.id}`}
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={overrides[v.id] ?? ""}
                            onChange={(e) => setOverrides({ ...overrides, [v.id]: e.target.value })}
                            className="h-10 w-28 px-3"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <Button type="submit" className="mt-4 w-full" loading={pending}>
                Save prices
              </Button>
            </form>
          ))}
      </Modal>
    </div>
  );
}
