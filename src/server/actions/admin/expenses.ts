"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { parseISTDate } from "@/lib/dates";
import { rupeesToPaise } from "@/lib/money";

const expenseSchema = z.object({
  title: z.string().trim().min(2, "Enter what it was for").max(80),
  amountRupees: z.number().positive("Enter an amount").max(10_000_000),
  category: z.string().trim().min(2).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export async function addExpense(input: z.input<typeof expenseSchema>) {
  return adminAction("reports", async () => {
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
    const date = parseISTDate(parsed.data.date);
    if (!date) return { ok: false, error: "Invalid date" };
    await db.expense.create({
      data: { title: parsed.data.title, amount: rupeesToPaise(parsed.data.amountRupees), category: parsed.data.category, date },
    });
    revalidatePath("/admin/reports");
    return { ok: true, message: "Expense added" };
  });
}

export async function deleteExpense(id: string) {
  return adminAction("reports", async () => {
    await db.expense.delete({ where: { id } });
    revalidatePath("/admin/reports");
    return { ok: true, message: "Expense deleted" };
  });
}
