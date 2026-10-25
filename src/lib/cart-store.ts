"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Fulfilment, Level, Size } from "@/lib/types";
import { lineKey } from "@/lib/cart-line";

/**
 * Cart state persisted to localStorage.
 * `unitPrice` is only for display – the server always reprices the cart (validateCart / placeOrder).
 */
export type CartLine = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: Size;
  sugar: Level;
  ice: Level;
  instructions: string;
  quantity: number;
  unitPrice: number;
};

export type AddToCartInput = Omit<CartLine, "key" | "quantity" | "instructions"> & {
  quantity?: number;
  instructions?: string;
};

export const MAX_LINE_QUANTITY = 20;

export { lineKey };

type CartState = {
  lines: CartLine[];
  fulfilment: Fulfilment;
  couponCode: string;
  pincode: string;
  setPincode: (pin: string) => void;
  add: (item: AddToCartInput) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setFulfilment: (f: Fulfilment) => void;
  setCouponCode: (code: string) => void;
  /** Refresh display prices/names after server validation. */
  syncPrices: (prices: Record<string, number>) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      fulfilment: "PICKUP",
      couponCode: "",
      pincode: "",
      setPincode: (pincode) => set({ pincode: pincode.replace(/\D/g, "").slice(0, 6) }),
      add: (item) => {
        const instructions = (item.instructions ?? "").trim().slice(0, 200);
        const key = lineKey({ ...item, instructions });
        const qty = Math.max(1, item.quantity ?? 1);
        const lines = get().lines;
        const existing = lines.find((l) => l.key === key);
        if (existing) {
          set({
            lines: lines.map((l) =>
              l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + qty), unitPrice: item.unitPrice } : l,
            ),
          });
        } else {
          set({
            lines: [
              ...lines,
              { ...item, instructions, key, quantity: Math.min(MAX_LINE_QUANTITY, qty) },
            ],
          });
        }
      },
      setQuantity: (key, quantity) =>
        set({
          lines: get()
            .lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l))
            .filter((l) => l.quantity > 0),
        }),
      remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
      clear: () => set({ lines: [], couponCode: "" }),
      setFulfilment: (fulfilment) => set({ fulfilment }),
      setCouponCode: (couponCode) => set({ couponCode: couponCode.trim().toUpperCase() }),
      syncPrices: (prices) =>
        set({
          lines: get().lines.map((l) => (prices[l.key] !== undefined ? { ...l, unitPrice: prices[l.key] } : l)),
        }),
    }),
    {
      name: "coolkick-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** True after the persisted cart has loaded (avoids hydration mismatches). */
export function useCartHydrated() {
  return useSyncExternalStore(
    (cb) => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
}

export function useCartCount() {
  const hydrated = useCartHydrated();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  return hydrated ? count : 0;
}
