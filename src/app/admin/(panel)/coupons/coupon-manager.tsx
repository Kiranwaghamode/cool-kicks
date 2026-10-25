"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { saveCoupon, setCouponActive } from "@/server/actions/admin/config";
import { couponConditions, couponHeadline } from "@/lib/coupons";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import type { CouponType } from "@/lib/types";

type Coupon = {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  validFrom: string;
  validTo: string;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  expired: boolean;
};

type Draft = {
  id?: string;
  code: string;
  description: string;
  type: CouponType;
  value: string; // percent or rupees
  minOrder: string; // rupees
  maxDiscount: string; // rupees
  buy: string;
  get: string;
  validFrom: string;
  validTo: string;
  usageLimit: string;
  isActive: boolean;
};

function toDraft(c: Coupon): Draft {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.type === "FLAT" ? String(paiseToRupees(c.value)) : String(c.value),
    minOrder: c.minOrderAmount ? String(paiseToRupees(c.minOrderAmount)) : "",
    maxDiscount: c.maxDiscount ? String(paiseToRupees(c.maxDiscount)) : "",
    buy: String(c.buyQuantity ?? 2),
    get: String(c.getQuantity ?? 1),
    validFrom: c.validFrom,
    validTo: c.validTo,
    usageLimit: c.usageLimit ? String(c.usageLimit) : "",
    isActive: c.isActive,
  };
}

export function CouponManager({ coupons, today }: { coupons: Coupon[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const blank: Draft = { code: "", description: "", type: "PERCENT", value: "10", minOrder: "", maxDiscount: "", buy: "2", get: "1", validFrom: today, validTo: today, usageLimit: "", isActive: true };

  function save(d: Draft) {
    start(async () => {
      const res = await saveCoupon({
        id: d.id,
        code: d.code,
        description: d.description,
        type: d.type,
        value: d.type === "FLAT" ? rupeesToPaise(Number(d.value) || 0) : Math.round(Number(d.value) || 0),
        minOrderAmount: d.minOrder ? rupeesToPaise(Number(d.minOrder)) : 0,
        maxDiscount: d.maxDiscount ? rupeesToPaise(Number(d.maxDiscount)) : null,
        buyQuantity: d.type === "BUY_X_GET_Y" ? Number(d.buy) || null : null,
        getQuantity: d.type === "BUY_X_GET_Y" ? Number(d.get) || null : null,
        validFrom: d.validFrom,
        validTo: d.validTo,
        usageLimit: d.usageLimit ? Number(d.usageLimit) : null,
        isActive: d.isActive,
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
  }

  return (
    <Panel
      title={`${coupons.length} coupons`}
      action={
        <Button size="sm" onClick={() => setDraft(blank)}>
          <Plus className="size-4" aria-hidden /> New coupon
        </Button>
      }
    >
      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" action={<Button onClick={() => setDraft(blank)}>Create one</Button>} />
      ) : (
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Code</th>
                <th className={th}>Offer</th>
                <th className={th}>Valid</th>
                <th className={th}>Used</th>
                <th className={th}>Active</th>
                <th className={th}>
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className={td}>
                    <span className="font-mono font-bold tracking-wider text-brand-deep">{c.code}</span>
                    {c.expired && (
                      <Badge tone="neutral" className="ml-2">
                        Expired
                      </Badge>
                    )}
                  </td>
                  <td className={td}>
                    <span className="font-semibold">{couponHeadline(c)}</span>
                    <span className="block text-xs text-ink-muted">{couponConditions(c)}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink-soft`}>
                    {c.validFrom} → {c.validTo}
                  </td>
                  <td className={`${td} tabular-nums`}>
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className={td}>
                    <Switch
                      checked={c.isActive}
                      label={`${c.code} active`}
                      onChange={(v) =>
                        start(async () => {
                          const res = await setCouponActive(c.id, v);
                          if (res.ok) {
                            toast.success(res.message ?? "Saved");
                            router.refresh();
                          } else toast.error("Not saved", res.error);
                        })
                      }
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(c))} aria-label={`Edit ${c.code}`}>
                      <Pencil className="size-4" aria-hidden /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Edit ${draft.code}` : "New coupon"}>
        {draft && (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save(draft);
            }}
          >
            <Field label="Code" htmlFor="cp-code" error={errors.code} required>
              <Input id="cp-code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} className="font-mono uppercase" />
            </Field>
            <Field label="Type" htmlFor="cp-type">
              <Select id="cp-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CouponType })}>
                <option value="PERCENT">Percent off</option>
                <option value="FLAT">Flat ₹ off</option>
                <option value="BUY_X_GET_Y">Buy X get Y free</option>
              </Select>
            </Field>
            {draft.type === "BUY_X_GET_Y" ? (
              <>
                <Field label="Buy (drinks)" htmlFor="cp-buy" error={errors.buyQuantity}>
                  <Input id="cp-buy" type="number" min={1} value={draft.buy} onChange={(e) => setDraft({ ...draft, buy: e.target.value })} />
                </Field>
                <Field label="Get free (cheapest)" htmlFor="cp-get">
                  <Input id="cp-get" type="number" min={1} value={draft.get} onChange={(e) => setDraft({ ...draft, get: e.target.value })} />
                </Field>
              </>
            ) : (
              <Field label={draft.type === "PERCENT" ? "Percent off" : "Amount off (₹)"} htmlFor="cp-value" error={errors.value}>
                <Input id="cp-value" type="number" min={1} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
              </Field>
            )}
            {draft.type !== "FLAT" && (
              <Field label="Max discount (₹)" htmlFor="cp-max" hint="Optional cap">
                <Input id="cp-max" type="number" min={0} value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: e.target.value })} />
              </Field>
            )}
            <Field label="Minimum order (₹)" htmlFor="cp-min" hint="Leave empty for none">
              <Input id="cp-min" type="number" min={0} value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: e.target.value })} />
            </Field>
            <Field label="Usage limit" htmlFor="cp-limit" hint="Total uses; empty = unlimited">
              <Input id="cp-limit" type="number" min={1} value={draft.usageLimit} onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })} />
            </Field>
            <Field label="Valid from" htmlFor="cp-from" error={errors.validFrom}>
              <Input id="cp-from" type="date" value={draft.validFrom} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} />
            </Field>
            <Field label="Valid until" htmlFor="cp-to" error={errors.validTo}>
              <Input id="cp-to" type="date" value={draft.validTo} onChange={(e) => setDraft({ ...draft, validTo: e.target.value })} />
            </Field>
            <Field label="Description (shown to customers)" htmlFor="cp-desc" className="sm:col-span-2">
              <Input id="cp-desc" value={draft.description} maxLength={120} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="10% off on orders above ₹200" />
            </Field>
            <label className="flex items-center justify-between font-semibold sm:col-span-2">
              Active
              <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Coupon active" />
            </label>
            <Button type="submit" className="sm:col-span-2" loading={pending}>
              Save coupon
            </Button>
          </form>
        )}
      </Modal>
    </Panel>
  );
}
