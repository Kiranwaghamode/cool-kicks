"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, PackageSearch, ReceiptText } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { getMyOrders, type MyOrderSummary } from "@/server/actions/tracking";
import { getLocalOrders } from "@/lib/local-orders";
import { ACTIVE_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { formatDateTime } from "@/lib/order-format";
import { formatPaise } from "@/lib/money";

type TabValue = "active" | "past" | "cancelled";

export function MyOrdersView() {
  const [orders, setOrders] = useState<MyOrderSummary[] | null>(null);
  const [tab, setTab] = useState<TabValue>("active");

  useEffect(() => {
    const local = getLocalOrders();
    if (!local.length) {
      Promise.resolve().then(() => setOrders([]));
      return;
    }
    getMyOrders(local.map(({ orderNumber, phone }) => ({ orderNumber, phone })))
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  const groups = {
    active: orders?.filter((o) => ACTIVE_STATUSES.includes(o.status)) ?? [],
    past: orders?.filter((o) => o.status === "DELIVERED") ?? [],
    cancelled: orders?.filter((o) => o.status === "CANCELLED" || o.status === "REJECTED") ?? [],
  };
  const visible = groups[tab];

  return (
    <div className="container-page py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-headline-sm font-extrabold md:text-headline">My Orders</h1>
            <p className="text-ink-soft">Orders placed on this device.</p>
          </div>
          <Link href="/track" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-deep hover:underline">
            <PackageSearch className="size-4" aria-hidden /> Find an order
          </Link>
        </header>

        <Tabs
          label="Order groups"
          value={tab}
          onChange={setTab}
          items={[
            { value: "active", label: "Active", count: orders ? groups.active.length : undefined },
            { value: "past", label: "Past", count: orders ? groups.past.length : undefined },
            { value: "cancelled", label: "Cancelled", count: orders ? groups.cancelled.length : undefined },
          ]}
          className="mb-5 w-fit max-w-full"
        />

        <div role="tabpanel" aria-label={tab}>
          {!orders ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-[28px] bg-surface shadow-warm-soft">
              <EmptyState
                icon={<ReceiptText />}
                title={orders.length === 0 ? "No orders yet" : `No ${tab} orders`}
                description={
                  orders.length === 0
                    ? "Orders you place on this device will show up here. Placed an order somewhere else? Use Find an order."
                    : "Nothing here right now."
                }
                action={
                  orders.length === 0 ? (
                    <div className="flex flex-wrap justify-center gap-3">
                      <LinkButton href="/menu">Order now</LinkButton>
                      <LinkButton href="/track" variant="outline">
                        Find an order
                      </LinkButton>
                    </div>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((o) => (
                <li key={o.orderNumber}>
                  <Link
                    href={`/track?order=${o.orderNumber}`}
                    className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-warm-soft transition hover:-translate-y-0.5 hover:shadow-warm md:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-extrabold tracking-wider text-brand-deep">{o.orderNumber}</span>
                        <Badge
                          tone={
                            o.status === "DELIVERED"
                              ? "success"
                              : o.status === "CANCELLED" || o.status === "REJECTED"
                                ? "danger"
                                : "mango"
                          }
                        >
                          {o.status === "DELIVERED" && o.fulfilment === "PICKUP" ? "Picked up" : STATUS_LABELS[o.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{o.itemsPreview}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatDateTime(o.createdAt)} · {o.fulfilment === "PICKUP" ? "Pickup" : "Delivery"}
                      </p>
                    </div>
                    <span className="font-extrabold tabular-nums">{formatPaise(o.total)}</span>
                    <ChevronRight className="size-5 text-ink-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
