"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PackageCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useBulkCart } from "@/lib/bulk-cart-store";
import { confirmDeliveryReceived, reorderLines } from "@/server/actions/business/orders";

export function OrderActions({ orderNumber, canReorder, canConfirm }: { orderNumber: string; canReorder: boolean; canConfirm: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const replace = useBulkCart((s) => s.replace);
  const cartSize = useBulkCart((s) => s.lines.length);

  return (
    <div className="space-y-2">
      {canConfirm && (
        <Button className="w-full" onClick={() => setConfirming(true)}>
          <PackageCheck className="size-4" aria-hidden /> Confirm goods received
        </Button>
      )}
      {canReorder && (
        <Button
          variant="outline"
          className="w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              if (cartSize > 0 && !window.confirm("Replace the items in your bulk cart with this order?")) return;
              const res = await reorderLines(orderNumber);
              if (res.ok && res.data) {
                if (!res.data.lines.length) return toast.error("Nothing to reorder", "These products are no longer available.");
                replace(res.data.lines);
                toast.success("Added to bulk cart", res.data.skipped ? `${res.data.skipped} item(s) are no longer available.` : "Prices updated to today's rates.");
                router.push("/business/cart");
              } else if (!res.ok) toast.error("Couldn't reorder", res.error);
            })
          }
        >
          <RotateCcw className="size-4" aria-hidden /> Repeat this order
        </Button>
      )}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirm receipt"
        footer={
          <Button
            className="w-full"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await confirmDeliveryReceived(orderNumber, name);
                if (res.ok) {
                  toast.success(res.message ?? "Confirmed");
                  setConfirming(false);
                  router.refresh();
                } else toast.error("Not confirmed", res.error);
              })
            }
          >
            Confirm received
          </Button>
        }
      >
        <p className="text-sm text-ink-soft">Let us know the goods reached you in good condition.</p>
        <Field label="Received by" htmlFor="rc-name" className="mt-4">
          <Input id="rc-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Name of the person who received it" />
        </Field>
      </Modal>
    </div>
  );
}
