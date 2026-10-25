"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

/** Make sure the cart is empty after a successful order (e.g. if the tab was refreshed mid-redirect). */
export function ConfirmationEffects() {
  useEffect(() => {
    try {
      sessionStorage.removeItem("coolkick-checkout-key");
    } catch {}
    if (useCart.getState().lines.length) useCart.getState().clear();
  }, []);
  return null;
}
