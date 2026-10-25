"use client";

import { useCallback } from "react";
import { useCart, type AddToCartInput } from "@/lib/cart-store";
import { toast } from "@/components/ui/toast";
import { SIZE_LABELS } from "@/lib/types";

/** Adds an item to the cart and shows a confirmation toast. */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  return useCallback(
    (item: AddToCartInput) => {
      add(item);
      toast.success("Added to cart", `${item.name} · ${SIZE_LABELS[item.size]}${item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}`);
      window.dispatchEvent(new CustomEvent("coolkick:added-to-cart"));
    },
    [add],
  );
}
