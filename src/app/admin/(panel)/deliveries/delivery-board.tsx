"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, Check, Pencil, Phone, Store, Truck, XCircle } from "lucide-react";
import { Panel, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { formatPaise } from "@/lib/money";
import { formatDayLabel } from "@/lib/dates";
import { statusLabel, type OrderStatus } from "@/lib/order-status";
import { DELIVERY_SLOT_LABELS, DELIVERY_SLOTS, DELIVERY_STATUS_LABELS, type DeliverySlot, type DeliveryStatus, type Fulfilment, type PaymentMethod } from "@/lib/types";
import { confirmDelivered, markDeliveryFailed, updateDelivery } from "@/server/actions/admin/deliveries";
import { updateOrderStatus } from "@/server/actions/admin/orders";

export type DeliveryCard = {
  orderId: string;
  orderNumber: string;
  business: string;
  phone: string;
  fulfilment: Fulfilment;
  orderStatus: OrderStatus;
  paymentMethod: PaymentMethod;
  due: number;
  address: string;
  units: number;
  date: string;
  slot: DeliverySlot;
  status: DeliveryStatus;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  note: string;
  overdue: boolean;
  receivedBy: string | null;
};

type Result = { ok: boolean; message?: string; error?: string };

export function DeliveryBoard({ cards, from, days, today }: { cards: DeliveryCard[]; from: string; days: number; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<DeliveryCard | null>(null);
  const [delivering, setDelivering] = useState<DeliveryCard | null>(null);
  const [failing, setFailing] = useState<DeliveryCard | null>(null);
  const [text, setText] = useState("");

  const run = (p: () => Promise<Result>, done?: () => void) =>
    start(async () => {
      const res = await p();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        done?.();
        router.refresh();
      } else toast.error("Not saved", res.error);
    });

  const groups = new Map<string, DeliveryCard[]>();
  for (const c of cards) {
    const key = c.overdue ? "overdue" : c.date;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <>
      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); router.push(`/admin/deliveries?from=${f.get("from")}&days=${f.get("days")}`); }}>
        <label className="text-xs font-semibold text-ink-soft">
          From
          <Input type="date" name="from" defaultValue={from} className="mt-1 h-10" />
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          Show
          <Select name="days" defaultValue={String(days)} className="mt-1 h-10">
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </Select>
        </label>
        <Button type="submit" variant="dark">
          Show
        </Button>
        {from !== today && (
          <Link href="/admin/deliveries" className="pb-2 text-sm font-semibold text-brand-deep underline">
            Today
          </Link>
        )}
      </form>

      {cards.length === 0 ? (
        <Panel>
          <EmptyState icon={<CalendarClock />} title="Nothing scheduled" description="Wholesale deliveries and pickups for these dates will appear here." />
        </Panel>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([key, list]) => (
            <Panel
              key={key}
              title={
                key === "overdue" ? (
                  <span className="flex items-center gap-2 text-danger">
                    <AlertTriangle className="size-5" aria-hidden /> Overdue
                  </span>
                ) : (
                  `${formatDayLabel(key)}${key === today ? " · today" : ""}`
                )
              }
            >
              <ul className="grid gap-3 lg:grid-cols-2">
                {list.map((c) => {
                  const canDispatch = c.orderStatus === "PACKED";
                  const canDeliver = c.orderStatus === "OUT_FOR_DELIVERY" || c.orderStatus === "READY_FOR_PICKUP";
                  return (
                    <li key={c.orderId} className="rounded-2xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link href={`/admin/orders?q=${c.orderNumber}&open=${c.orderNumber}`} className="font-bold text-brand-deep hover:underline">
                            {c.orderNumber}
                          </Link>{" "}
                          <span className="font-semibold">{c.business}</span>
                          <p className="text-xs text-ink-muted">
                            {c.overdue ? `${formatDayLabel(c.date)} · ` : ""}
                            {DELIVERY_SLOT_LABELS[c.slot]} · {c.units} units
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge status={c.orderStatus} />
                          {c.status === "FAILED" && <Badge tone="danger">{DELIVERY_STATUS_LABELS.FAILED}</Badge>}
                        </div>
                      </div>
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
                        {c.fulfilment === "DELIVERY" ? <Truck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Store className="mt-0.5 size-4 shrink-0" aria-hidden />}
                        {c.fulfilment === "DELIVERY" ? c.address : "Pickup at the shop"}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                        <a href={`tel:+91${c.phone}`} className="flex items-center gap-1 text-ink-soft hover:text-brand-deep">
                          <Phone className="size-3.5" aria-hidden /> {c.phone}
                        </a>
                        {c.driverName && (
                          <span className="text-ink-soft">
                            Driver: {c.driverName}
                            {c.vehicle ? ` · ${c.vehicle}` : ""}
                          </span>
                        )}
                        {c.due > 0 && (c.paymentMethod === "CASH_ON_DELIVERY" || c.paymentMethod === "PAY_AT_SHOP") && <span className="font-semibold text-warning">Collect {formatPaise(c.due)}</span>}
                      </p>
                      {c.note && <p className="mt-1 text-xs text-ink-muted">📝 {c.note}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canDispatch && (
                          <Button size="sm" loading={pending} onClick={() => run(() => updateOrderStatus({ orderId: c.orderId, to: c.fulfilment === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY" }))}>
                            <Truck className="size-4" aria-hidden /> {c.fulfilment === "PICKUP" ? "Ready for pickup" : "Dispatch"}
                          </Button>
                        )}
                        {canDeliver && (
                          <Button size="sm" onClick={() => { setText(""); setDelivering(c); }}>
                            <Check className="size-4" aria-hidden /> {c.fulfilment === "PICKUP" ? "Picked up" : "Delivered"}
                          </Button>
                        )}
                        {c.orderStatus === "OUT_FOR_DELIVERY" && c.status !== "FAILED" && (
                          <Button size="sm" variant="outline" className="text-danger" onClick={() => { setText(""); setFailing(c); }}>
                            <XCircle className="size-4" aria-hidden /> Failed
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          <Pencil className="size-4" aria-hidden /> Schedule & driver
                        </Button>
                        {!canDispatch && !canDeliver && c.orderStatus !== "OUT_FOR_DELIVERY" && <span className="self-center text-xs text-ink-muted">Next: {statusLabel(c.orderStatus, "WHOLESALE")} → pack the order on the Orders board</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Delivery for ${editing.orderNumber}` : "Delivery"}>
        {editing && (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateDelivery({ orderId: editing.orderId, scheduledDate: editing.date, slot: editing.slot, driverName: editing.driverName, driverPhone: editing.driverPhone, vehicle: editing.vehicle, note: editing.note }), () => setEditing(null));
            }}
          >
            <Field label="Date" htmlFor="dv-date">
              <Input id="dv-date" type="date" min={today} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label="Slot" htmlFor="dv-slot">
              <Select id="dv-slot" value={editing.slot} onChange={(e) => setEditing({ ...editing, slot: e.target.value as DeliverySlot })}>
                {DELIVERY_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {DELIVERY_SLOT_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Driver name" htmlFor="dv-driver">
              <Input id="dv-driver" value={editing.driverName} maxLength={60} onChange={(e) => setEditing({ ...editing, driverName: e.target.value })} />
            </Field>
            <Field label="Driver mobile" htmlFor="dv-phone">
              <Input id="dv-phone" type="tel" value={editing.driverPhone} onChange={(e) => setEditing({ ...editing, driverPhone: e.target.value })} />
            </Field>
            <Field label="Vehicle" htmlFor="dv-vehicle">
              <Input id="dv-vehicle" value={editing.vehicle} maxLength={30} placeholder="MH12 AB 1234" onChange={(e) => setEditing({ ...editing, vehicle: e.target.value })} />
            </Field>
            <Field label="Note" htmlFor="dv-note">
              <Input id="dv-note" value={editing.note} maxLength={200} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
            <Button type="submit" className="sm:col-span-2" loading={pending}>
              Save
            </Button>
          </form>
        )}
      </Modal>

      <Modal
        open={!!delivering}
        onClose={() => setDelivering(null)}
        title="Confirm delivery"
        footer={
          <Button className="w-full" loading={pending} onClick={() => delivering && run(() => confirmDelivered(delivering.orderId, text), () => setDelivering(null))}>
            Mark delivered
          </Button>
        }
      >
        {delivering && delivering.due > 0 && <p className="mb-3 rounded-xl bg-mango-soft px-3 py-2 text-sm font-semibold text-warning">{formatPaise(delivering.due)} is still unpaid – record any payment collected on the order.</p>}
        <Field label="Received by" htmlFor="dv-recv">
          <Input id="dv-recv" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} placeholder="Name of the person who signed" />
        </Field>
      </Modal>

      <Modal
        open={!!failing}
        onClose={() => setFailing(null)}
        title="Delivery failed"
        footer={
          <Button variant="danger" className="w-full" loading={pending} onClick={() => failing && run(() => markDeliveryFailed(failing.orderId, text), () => setFailing(null))}>
            Mark failed
          </Button>
        }
      >
        <Field label="What happened?" htmlFor="dv-fail">
          <Input id="dv-fail" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Shop closed, nobody to receive…" />
        </Field>
      </Modal>
    </>
  );
}
