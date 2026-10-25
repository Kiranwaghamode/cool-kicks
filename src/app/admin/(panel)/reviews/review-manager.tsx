"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { Panel } from "@/components/admin/ui";
import { Stars } from "@/components/shop/review-card";
import { deleteReview, setReviewApproved } from "@/server/actions/admin/config";
import { formatDateTime } from "@/lib/order-format";

type Review = { id: string; customerName: string; rating: number; comment: string; product: string | null; orderNumber: string | null; isApproved: boolean; createdAt: string };

export function ReviewManager({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"pending" | "approved">(reviews.some((r) => !r.isApproved) ? "pending" : "approved");
  const visible = reviews.filter((r) => (tab === "pending" ? !r.isApproved : r.isApproved));

  function run(p: Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const res = await p;
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.refresh();
      } else toast.error("Not saved", res.error);
    });
  }

  return (
    <Panel>
      <Tabs
        label="Review status"
        value={tab}
        onChange={setTab}
        items={[
          { value: "pending", label: "Waiting for approval", count: reviews.filter((r) => !r.isApproved).length },
          { value: "approved", label: "Visible on site", count: reviews.filter((r) => r.isApproved).length },
        ]}
        className="mb-4 w-fit max-w-full"
      />
      {visible.length === 0 ? (
        <EmptyState title={tab === "pending" ? "Nothing to approve" : "No visible reviews"} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((r) => (
            <li key={r.id} className="flex flex-col rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{r.customerName}</p>
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(r.createdAt)}
                    {r.orderNumber ? ` · ${r.orderNumber}` : ""}
                    {r.product ? ` · ${r.product}` : ""}
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>
              <p className="mt-3 flex-1 text-ink-soft">“{r.comment}”</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.isApproved ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(setReviewApproved(r.id, false))}>
                    <EyeOff className="size-4" aria-hidden /> Hide
                  </Button>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => run(setReviewApproved(r.id, true))}>
                    <Check className="size-4" aria-hidden /> Approve
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(deleteReview(r.id))}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </Button>
                {r.isApproved && <Badge tone="success" className="ml-auto self-center">Live</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
