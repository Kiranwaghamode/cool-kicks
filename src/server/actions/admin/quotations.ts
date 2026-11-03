"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";
import { audit } from "@/server/audit";
import { recalcQuotation } from "@/server/quotations";
import { addDays, parseISTDate, startOfDayIST } from "@/lib/dates";
import { formatPaise } from "@/lib/money";

function refresh(id?: string) {
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/quotations/${id}`);
  revalidatePath("/business", "layout");
}

const paise = z.number().int().min(0).max(1_000_000_000);

const updateSchema = z.object({
  id: z.string().min(1),
  items: z
    .array(z.object({ id: z.string().min(1), unitPrice: z.number().int().min(1, "Every item needs a price").max(100_000_000), quantity: z.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(100),
  discount: paise,
  deliveryFee: paise,
  validUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().default(""),
  staffNote: z.string().trim().max(1000).optional().default(""),
  send: z.boolean(),
});

export type QuotationUpdateInput = z.input<typeof updateSchema>;

/** Prepare (and optionally send) a quote: set prices, quantities, discount, delivery and validity. */
export async function updateQuotation(input: QuotationUpdateInput) {
  return adminAction("quotations", async (staff) => {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the quotation." };
    const v = parsed.data;
    const q = await db.quotation.findUnique({ where: { id: v.id }, select: { status: true, number: true, items: { select: { id: true } } } });
    if (!q) return { ok: false, error: "Quotation not found" };
    if (q.status !== "REQUESTED" && q.status !== "QUOTED") return { ok: false, error: "This quotation is closed and can't be changed." };
    const own = new Set(q.items.map((i) => i.id));
    if (v.items.some((i) => !own.has(i.id))) return { ok: false, error: "Invalid item" };
    if (v.items.every((i) => i.quantity === 0)) return { ok: false, error: "Keep at least one item (or cancel the quotation)." };

    let validUntil: Date | null = null;
    if (v.validUntil) {
      const d = parseISTDate(v.validUntil);
      if (!d || d < startOfDayIST()) return { ok: false, error: "Valid-until date must be today or later." };
      validUntil = new Date(addDays(d, 1).getTime() - 1); // end of that day
    } else if (v.send) {
      const s = await db.shopSettings.findUniqueOrThrow({ where: { id: 1 }, select: { quotationValidDays: true } });
      validUntil = new Date(addDays(startOfDayIST(), s.quotationValidDays + 1).getTime() - 1);
    }

    const totals = await db.$transaction(async (tx) => {
      for (const i of v.items) {
        if (i.quantity === 0) await tx.quotationItem.delete({ where: { id: i.id } });
        else await tx.quotationItem.update({ where: { id: i.id }, data: { unitPrice: i.unitPrice, quantity: i.quantity } });
      }
      await tx.quotation.update({
        where: { id: v.id },
        data: {
          discount: v.discount,
          deliveryFee: v.deliveryFee,
          staffNote: v.staffNote || null,
          validUntil,
          preparedById: staff.id,
          ...(v.send ? { status: "QUOTED", quotedAt: new Date() } : {}),
        },
      });
      const t = await recalcQuotation(tx, v.id);
      await audit(
        { staffId: staff.id },
        { action: v.send ? "quotation.send" : "quotation.save", entityType: "Quotation", entityId: v.id, summary: `${v.send ? "Sent" : "Saved"} ${q.number} · ${formatPaise(t.total)}` },
        tx,
      );
      return t;
    });
    refresh(v.id);
    return { ok: true, message: v.send ? `Quote sent · ${formatPaise(totals.total)}` : "Draft saved" };
  });
}

export async function cancelQuotation(id: string, reason: string) {
  return adminAction("quotations", async (staff) => {
    const why = reason.trim();
    if (why.length < 3) return { ok: false, error: "Give a reason – the business will see it." };
    const q = await db.quotation.findUnique({ where: { id }, select: { number: true } });
    if (!q) return { ok: false, error: "Quotation not found" };
    const updated = await db.quotation.updateMany({ where: { id, status: { in: ["REQUESTED", "QUOTED"] } }, data: { status: "CANCELLED", staffNote: why.slice(0, 1000) } });
    if (updated.count === 0) return { ok: false, error: "This quotation is already closed." };
    await audit({ staffId: staff.id }, { action: "quotation.cancel", entityType: "Quotation", entityId: id, summary: `Cancelled ${q.number}: ${why}` });
    refresh(id);
    return { ok: true, message: "Quotation cancelled" };
  });
}
