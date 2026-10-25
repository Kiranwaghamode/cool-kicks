"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminAction } from "@/server/auth-guard";

/** Top-bar "Shop open" switch: toggles temporary closure mode. */
export async function setShopOpen(open: boolean) {
  return adminAction("shopToggle", async () => {
    await db.shopSettings.update({
      where: { id: 1 },
      data: { isTemporarilyClosed: !open },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: open ? "Shop is open for orders" : "Shop closed – customers can't order" };
  });
}

/** Quick search from the top bar: order number or phone → orders page. */
export async function findOrderQuick(q: string) {
  return adminAction("orders", async () => {
    const term = q.trim().toUpperCase();
    if (!term) return { ok: false, error: "Type an order number or phone" };
    return { ok: true, data: { href: `/admin/orders?q=${encodeURIComponent(term)}` } };
  });
}
