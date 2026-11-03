"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Fulfilment, Size } from "@/lib/types";
import { MAX_WHOLESALE_QTY } from "@/lib/b2b-validation";

/**
 * Wholesale (bulk) cart, persisted to localStorage and kept separate from the retail cart.
 * `unitPrice` is display-only – the server re-prices everything (pricing rules are per business).
 */
export type BulkLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: Size;
  volumeMl: number;
  packSize: number;
  moq: number;
  packaging: string | null;
  quantity: number;
  unitPrice: number;
};

type BulkCartState = {
  /** Business the cart belongs to – cleared if someone else logs in on this browser. */
  ownerId: string | null;
  lines: BulkLine[];
  fulfilment: Fulfilment;
  addressId: string;
  ensureOwner: (businessId: string) => void;
  add: (line: BulkLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  replace: (lines: BulkLine[]) => void;
  clear: () => void;
  setFulfilment: (f: Fulfilment) => void;
  setAddressId: (id: string) => void;
  syncPrices: (prices: Record<string, number>) => void;
};

/** Round a quantity to a valid pack multiple (never below MOQ). */
export function normalizeQuantity(qty: number, packSize: number, moq: number) {
  const pack = Math.max(1, packSize);
  const rounded = Math.ceil(Math.max(qty, moq, 1) / pack) * pack;
  return Math.min(rounded, Math.floor(MAX_WHOLESALE_QTY / pack) * pack);
}

export const useBulkCart = create<BulkCartState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      lines: [],
      fulfilment: "DELIVERY",
      addressId: "",
      ensureOwner: (businessId) => {
        if (get().ownerId !== businessId) set({ ownerId: businessId, lines: [], addressId: "", fulfilment: "DELIVERY" });
      },
      add: (line) => {
        const existing = get().lines.find((l) => l.variantId === line.variantId);
        const quantity = normalizeQuantity((existing?.quantity ?? 0) + line.quantity, line.packSize, line.moq);
        set({
          lines: existing
            ? get().lines.map((l) => (l.variantId === line.variantId ? { ...line, quantity } : l))
            : [...get().lines, { ...line, quantity }],
        });
      },
      setQuantity: (variantId, quantity) =>
        set({
          lines: get()
            .lines.map((l) => (l.variantId === variantId ? { ...l, quantity: quantity <= 0 ? 0 : normalizeQuantity(quantity, l.packSize, l.moq) } : l))
            .filter((l) => l.quantity > 0),
        }),
      remove: (variantId) => set({ lines: get().lines.filter((l) => l.variantId !== variantId) }),
      replace: (lines) => set({ lines }),
      clear: () => set({ lines: [] }),
      setFulfilment: (fulfilment) => set({ fulfilment }),
      setAddressId: (addressId) => set({ addressId }),
      syncPrices: (prices) =>
        set({ lines: get().lines.map((l) => (prices[l.variantId] !== undefined ? { ...l, unitPrice: prices[l.variantId] } : l)) }),
    }),
    { name: "coolkick-bulk-cart", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export function useBulkCartHydrated() {
  return useSyncExternalStore(
    (cb) => useBulkCart.persist.onFinishHydration(cb),
    () => useBulkCart.persist.hasHydrated(),
    () => false,
  );
}

/** Number of lines (not units – bulk quantities would make the badge meaningless). */
export function useBulkCartCount() {
  const hydrated = useBulkCartHydrated();
  const count = useBulkCart((s) => s.lines.length);
  return hydrated ? count : 0;
}
