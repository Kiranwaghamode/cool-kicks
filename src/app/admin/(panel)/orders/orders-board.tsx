"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellRing, Bike, ChevronLeft, ChevronRight, RefreshCw, Store, Volume2, VolumeX } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PaymentBadge, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { OrderDrawer } from "./order-drawer";
import { formatPaise } from "@/lib/money";
import { formatDateTime } from "@/lib/order-format";
import { PAYMENT_METHOD_LABELS, type Fulfilment, type PaymentMethod, type PaymentStatus } from "@/lib/types";
import type { OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export type TabKey = "ALL" | "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "OUT" | "DELIVERED" | "CLOSED";

export type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfilment: Fulfilment;
  status: OrderStatus;
  createdAt: string;
};

const TABS: { value: TabKey; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "OUT", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CLOSED", label: "Cancelled / Rejected" },
  { value: "ALL", label: "All" },
];

const REFRESH_MS = 15_000;

/** Short two-tone chime using Web Audio (no sound file needed). */
function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    /* audio blocked */
  }
}

export function OrdersBoard({
  rows,
  counts,
  tab,
  q,
  from,
  to,
  page,
  pageCount,
  total,
  canRefund,
  openOrder,
}: {
  rows: OrderRow[];
  counts: Record<TabKey, number>;
  tab: TabKey;
  q: string;
  from: string;
  to: string;
  page: number;
  pageCount: number;
  total: number;
  canRefund: boolean;
  openOrder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const [sound, setSound] = useState(true);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const knownNew = useRef<Set<string> | null>(null);
  const newCount = counts.NEW;
  const prevNewCount = useRef(newCount);

  function go(update: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(update)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in update)) next.delete("page");
    next.delete("status");
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  // Auto refresh.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setLastRefresh(new Date());
      }
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  // Detect newly arrived orders: highlight + chime.
  useEffect(() => {
    const placed = rows.filter((r) => r.status === "PLACED").map((r) => r.orderNumber);
    if (knownNew.current === null) {
      knownNew.current = new Set(placed);
      return;
    }
    const arrived = placed.filter((n) => !knownNew.current!.has(n));
    const countGrew = newCount > prevNewCount.current;
    prevNewCount.current = newCount;
    placed.forEach((n) => knownNew.current!.add(n));
    if (arrived.length || countGrew) {
      if (sound) chime();
      if (arrived.length) {
        setFresh((s) => new Set([...s, ...arrived]));
        setTimeout(() => setFresh((s) => new Set([...s].filter((n) => !arrived.includes(n)))), 20_000);
      }
    }
  }, [rows, newCount, sound]);

  return (
    <>
      {newCount > 0 && tab !== "NEW" && (
        <button
          type="button"
          onClick={() => go({ tab: "NEW" })}
          className="mb-4 flex w-full items-center gap-3 rounded-[20px] bg-melon px-5 py-3 text-left font-bold text-white"
        >
          <BellRing className="size-5" aria-hidden /> {newCount} new order{newCount === 1 ? "" : "s"} to accept
        </button>
      )}

      <Tabs
        label="Order status"
        value={tab}
        onChange={(v) => go({ tab: v === "ALL" ? null : v })}
        items={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
        className="mb-4"
      />

      <Panel>
        <form
          className="mb-4 flex flex-col gap-3 md:flex-row md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            go({ q: search.trim() || null, from: String(fd.get("from") || "") || null, to: String(fd.get("to") || "") || null });
          }}
        >
          <div className="flex-1">
            <label htmlFor="o-q" className="mb-1 block pl-1 text-xs font-semibold text-ink-soft">
              Search
            </label>
            <Input id="o-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number, phone or name" className="h-11" />
          </div>
          <div>
            <label htmlFor="o-from" className="mb-1 block pl-1 text-xs font-semibold text-ink-soft">
              From
            </label>
            <Input id="o-from" name="from" type="date" defaultValue={from} className="h-11" />
          </div>
          <div>
            <label htmlFor="o-to" className="mb-1 block pl-1 text-xs font-semibold text-ink-soft">
              To
            </label>
            <Input id="o-to" name="to" type="date" defaultValue={to} className="h-11" />
          </div>
          <Button type="submit" variant="dark">
            Apply
          </Button>
          {(q || from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                go({ q: null, from: null, to: null });
              }}
            >
              Clear
            </Button>
          )}
        </form>

        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>
            {total} order{total === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <RefreshCw className="size-3.5" aria-hidden /> Auto-refresh 15s{lastRefresh ? ` · ${lastRefresh.toLocaleTimeString("en-IN")}` : ""}
            </span>
            <button type="button" onClick={() => setSound((s) => !s)} className="flex items-center gap-1 font-semibold text-ink-soft" aria-pressed={sound}>
              {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />} Sound {sound ? "on" : "off"}
            </button>
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No orders here" description={q || from || to ? "Try clearing the filters." : "New orders will appear here automatically."} />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Order</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Items</th>
                  <th className={th}>Total</th>
                  <th className={th}>Payment</th>
                  <th className={th}>Type</th>
                  <th className={th}>Status</th>
                  <th className={th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => go({ open: r.orderNumber, page: String(page) })}
                    className={cn(
                      "cursor-pointer border-b border-line transition last:border-0 hover:bg-cream-50",
                      fresh.has(r.orderNumber) && "animate-pulse bg-melon-soft",
                      r.status === "PLACED" && !fresh.has(r.orderNumber) && "bg-melon-soft/40",
                    )}
                  >
                    <td className={td}>
                      <button
                        type="button"
                        className="font-mono font-bold text-brand-deep hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          go({ open: r.orderNumber, page: String(page) });
                        }}
                      >
                        {r.orderNumber}
                      </button>
                    </td>
                    <td className={td}>
                      <span className="font-semibold">{r.customerName}</span>
                      <a href={`tel:+91${r.customerPhone}`} onClick={(e) => e.stopPropagation()} className="block text-xs text-ink-muted hover:text-brand-deep">
                        {r.customerPhone}
                      </a>
                    </td>
                    <td className={`${td} tabular-nums`}>{r.itemCount}</td>
                    <td className={`${td} font-bold tabular-nums`}>{formatPaise(r.total)}</td>
                    <td className={td}>
                      <span className="block text-xs text-ink-soft">{PAYMENT_METHOD_LABELS[r.paymentMethod]}</span>
                      <PaymentBadge status={r.paymentStatus} />
                    </td>
                    <td className={td}>
                      <span className="flex items-center gap-1 text-ink-soft">
                        {r.fulfilment === "PICKUP" ? <Store className="size-4" aria-hidden /> : <Bike className="size-4" aria-hidden />}
                        {r.fulfilment === "PICKUP" ? "Pickup" : "Delivery"}
                      </span>
                    </td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-ink-soft`}>{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}

        {pageCount > 1 && (
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            <span className="text-sm text-ink-soft">
              Page {page} of {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => go({ page: String(page + 1) })}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          </nav>
        )}
      </Panel>

      <OrderDrawer orderNumber={openOrder || null} canRefund={canRefund} onClose={() => go({ open: null, page: String(page) })} />
    </>
  );
}
