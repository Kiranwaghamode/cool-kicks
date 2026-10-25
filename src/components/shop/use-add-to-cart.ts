"use client";

import { useCallback } from "react";
import { useCart, type AddToCartInput } from "@/lib/cart-store";
import { toast } from "@/components/ui/toast";
import { SIZE_LABELS } from "@/lib/types";

/** Adds an item to the cart, shows a toast and triggers the fly-to-cart animation from `origin`. */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  return useCallback(
    (item: AddToCartInput, origin?: HTMLElement | null) => {
      add(item);
      toast.success("Added to cart", `${item.name} · ${SIZE_LABELS[item.size]}${item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}`);
      const r = origin?.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("coolkick:added-to-cart", {
          detail: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, image: item.image } : undefined,
        }),
      );
      if (origin && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        origin.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(0.96)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
      }
    },
    [add],
  );
}
