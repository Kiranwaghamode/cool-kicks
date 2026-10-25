"use server";

import { cartInputSchema, type CartInput } from "@/lib/validation";
import { priceCart, type PricedCart } from "@/server/cart";

export type ValidateCartResult = { ok: true; cart: PricedCart } | { ok: false; error: string };

/**
 * Re-price the browser's cart with current database prices, availability, coupon and delivery zone.
 * The cart page shows these numbers – never the browser's own.
 */
export async function validateCart(input: CartInput): Promise<ValidateCartResult> {
  const parsed = cartInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Your cart couldn't be checked." };
  }
  try {
    return { ok: true, cart: await priceCart(parsed.data) };
  } catch (e) {
    console.error("validateCart failed", e);
    return { ok: false, error: "We couldn't check your cart right now. Please try again." };
  }
}
