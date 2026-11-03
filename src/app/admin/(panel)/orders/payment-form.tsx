"use client";

import { useState, useTransition } from "react";
import { Banknote, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { istDateKey } from "@/lib/dates";
import { formatPaise, paiseToRupees, rupeesToPaise } from "@/lib/money";
import { PAYMENT_MODE_LABELS, PAYMENT_MODES, type PaymentMode } from "@/lib/types";
import { recordPayment, recordRefund } from "@/server/actions/admin/orders";

/** Record a (partial / advance) payment or a refund against a wholesale order. */
export function PaymentForm({ orderId, balance, paid, canRefund, onDone }: { orderId: string; balance: number; paid: number; canRefund: boolean; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"PAYMENT" | "REFUND" | null>(null);
  const today = istDateKey(new Date());
  const [f, setF] = useState({ amount: "", mode: "BANK_TRANSFER" as PaymentMode, reference: "", note: "", receivedAt: today });

  function open(k: "PAYMENT" | "REFUND") {
    setF({ amount: String(paiseToRupees(k === "PAYMENT" ? balance : paid)), mode: "BANK_TRANSFER", reference: "", note: "", receivedAt: today });
    setKind(k);
  }

  function submit() {
    if (!kind) return;
    start(async () => {
      const input = { orderId, amount: rupeesToPaise(Number(f.amount) || 0), mode: f.mode, reference: f.reference, note: f.note, receivedAt: f.receivedAt };
      const res = kind === "PAYMENT" ? await recordPayment(input) : await recordRefund(input);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setKind(null);
        onDone();
      } else toast.error("Not saved", res.error);
    });
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {balance > 0 && (
          <Button size="sm" variant="secondary" onClick={() => open("PAYMENT")}>
            <Banknote className="size-4" aria-hidden /> Record payment
          </Button>
        )}
        {canRefund && paid > 0 && (
          <Button size="sm" variant="outline" onClick={() => open("REFUND")}>
            <Undo2 className="size-4" aria-hidden /> Refund
          </Button>
        )}
      </div>
      <Modal
        open={!!kind}
        onClose={() => setKind(null)}
        title={kind === "REFUND" ? "Record refund" : "Record payment"}
        footer={
          <Button className="w-full" variant={kind === "REFUND" ? "dark" : "primary"} loading={pending} onClick={submit}>
            {kind === "REFUND" ? "Record refund" : "Record payment"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" htmlFor="pf-amount" hint={kind === "PAYMENT" ? `Balance due ${formatPaise(balance)}` : `Paid so far ${formatPaise(paid)}`}>
            <Input id="pf-amount" type="number" min={0.01} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Date" htmlFor="pf-date">
            <Input id="pf-date" type="date" max={today} value={f.receivedAt} onChange={(e) => setF({ ...f, receivedAt: e.target.value })} />
          </Field>
          <Field label="Mode" htmlFor="pf-mode">
            <Select id="pf-mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as PaymentMode })}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="pf-ref" hint="UTR, cheque no., UPI ref">
            <Input id="pf-ref" value={f.reference} maxLength={60} onChange={(e) => setF({ ...f, reference: e.target.value })} />
          </Field>
          <Field label={kind === "REFUND" ? "Reason" : "Note"} htmlFor="pf-note" className="sm:col-span-2">
            <Input id="pf-note" value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
