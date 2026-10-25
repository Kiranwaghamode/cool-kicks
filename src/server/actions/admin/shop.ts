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

