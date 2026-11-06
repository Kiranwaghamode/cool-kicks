"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SHOP_NAME } from "@/lib/brand";

const ShopNameContext = createContext(DEFAULT_SHOP_NAME);

/** Makes the shop name from Settings available to client components (set once in the root layout). */
export function ShopNameProvider({ name, children }: { name: string; children: ReactNode }) {
  return <ShopNameContext.Provider value={name}>{children}</ShopNameContext.Provider>;
}

export function useShopName() {
  return useContext(ShopNameContext);
}
