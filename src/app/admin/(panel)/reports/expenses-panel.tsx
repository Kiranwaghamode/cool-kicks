"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { Panel, TableWrap, td, th } from "@/components/admin/ui";
import { addExpense, deleteExpense } from "@/server/actions/admin/expenses";
import { formatPaise } from "@/lib/money";

const CATEGORIES = ["Fruit & produce", "Dairy", "Syrups & supplies", "Packaging", "Rent", "Salaries", "Electricity", "Other"];

export function ExpensesPanel({
  expenses,
  total,
  net,
  balance,
  defaultDate,
}: {
  expenses: { id: string; title: string; amount: number; category: string; date: string }[];
  total: number;
  net: number;
  balance: number;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ title: "", amount: "", category: CATEGORIES[0], date: defaultDate });

  return (
    <Panel title="Expenses (optional)" className="mt-5">
      <div className="mb-5 grid gap-3 rounded-2xl bg-cream-50 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-ink-soft">Net sales</p>
          <p className="text-xl font-extrabold tabular-nums">{formatPaise(net)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-soft">Expenses</p>
          <p className="text-xl font-extrabold tabular-nums">−{formatPaise(total)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-soft">Estimated balance (not accounting profit)</p>
          <p className={`text-xl font-extrabold tabular-nums ${balance < 0 ? "text-danger" : "text-brand-deep"}`}>{formatPaise(balance)}</p>
        </div>
      </div>

      <form
        className="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_1.3fr_1fr_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addExpense({ title: form.title, amountRupees: Number(form.amount), category: form.category, date: form.date });
            if (res.ok) {
              toast.success(res.message ?? "Added");
              setForm({ ...form, title: "", amount: "" });
              router.refresh();
            } else toast.error("Not added", res.error);
          });
        }}
      >
        <Field label="What for" htmlFor="ex-title">
          <Input id="ex-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fruit market – mangoes" className="h-11" />
        </Field>
        <Field label="Amount (₹)" htmlFor="ex-amount">
          <Input id="ex-amount" type="number" min={1} step="0.5" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-11" />
        </Field>
        <Field label="Category" htmlFor="ex-cat">
          <Select id="ex-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-11">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="ex-date">
          <Input id="ex-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" />
        </Field>
        <Button type="submit" loading={pending}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </form>

      {expenses.length ? (
        <TableWrap>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Date</th>
                <th className={th}>Expense</th>
                <th className={th}>Category</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className={`${td} text-ink-soft`}>{new Date(e.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</td>
                  <td className={`${td} font-semibold`}>{e.title}</td>
                  <td className={`${td} text-ink-soft`}>{e.category}</td>
                  <td className={`${td} text-right font-bold tabular-nums`}>{formatPaise(e.amount)}</td>
                  <td className={`${td} text-right`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${e.title}`}
                      onClick={() =>
                        start(async () => {
                          const res = await deleteExpense(e.id);
                          if (res.ok) router.refresh();
                          else toast.error("Not deleted", res.error);
                        })
                      }
                    >
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <p className="text-sm text-ink-muted">No expenses recorded in this period.</p>
      )}
    </Panel>
  );
}
