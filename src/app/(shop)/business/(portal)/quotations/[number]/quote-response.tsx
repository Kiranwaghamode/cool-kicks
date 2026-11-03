"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { CheckoutFields, paymentChoices, type CheckoutDetails, type CheckoutFieldOptions } from "@/components/shop/business/checkout-fields";
import { formatPaise } from "@/lib/money";
import type { Fulfilment } from "@/lib/types";
import { acceptQuotation, declineQuotation } from "@/server/actions/business/quotations";

export function QuoteResponse({
  number,
  status,
  fulfilment,
  total,
  options,
}: {
  number: string;
  status: "QUOTED" | "REQUESTED";
  fulfilment: Fulfilment;
  total: number;
  options: CheckoutFieldOptions;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [accepting, setAccepting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const key = useRef<string>("");
  const firstMethod = paymentChoices(fulfilment, total, options).find((c) => !c.disabled)?.value ?? "BANK_TRANSFER";
  const [details, setDetails] = useState<CheckoutDetails>({ scheduledDate: options.earliestDate, slot: "MORNING", paymentMethod: firstMethod, poNumber: "", poDate: "", notes: "" });

  function accept() {
    if (!key.current) key.current = crypto.randomUUID();
    start(async () => {
      const res = await acceptQuotation({ number, idempotencyKey: key.current, details });
      if (res.ok && res.data) {
        toast.success("Order placed", `Quotation accepted – order ${res.data.orderNumber}.`);
        router.push(`/business/orders/${res.data.orderNumber}?placed=1`);
      } else if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error("Couldn't accept", res.error);
      }
    });
  }

  function decline() {
    start(async () => {
      const res = await declineQuotation(number, "");
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else toast.error("Not updated", res.error);
    });
  }

  return (
    <div className="space-y-2">
      {status === "QUOTED" && (
        <Button size="lg" className="w-full" onClick={() => setAccepting(true)}>
          <Check className="size-5" aria-hidden /> Accept & place order
        </Button>
      )}
      <Button variant="outline" className="w-full text-danger" loading={pending && !accepting} onClick={decline}>
        <X className="size-4" aria-hidden /> {status === "QUOTED" ? "Decline quotation" : "Withdraw request"}
      </Button>
      <Modal
        open={accepting}
        onClose={() => setAccepting(false)}
        title={`Accept ${number}`}
        className="max-w-2xl"
        footer={
          <Button size="lg" className="w-full" loading={pending} onClick={accept}>
            Place order · {formatPaise(total)}
          </Button>
        }
      >
        <CheckoutFields value={details} onChange={setDetails} fulfilment={fulfilment} total={total} options={options} errors={errors} />
      </Modal>
    </div>
  );
}
