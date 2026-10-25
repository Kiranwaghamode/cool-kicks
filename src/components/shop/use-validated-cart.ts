"use client";

import { useEffect, useRef, useState } from "react";
import { useCart, useCartHydrated } from "@/lib/cart-store";
import { validateCart } from "@/server/actions/cart";
import type { PricedCart } from "@/server/cart";

/**
 * Keeps a server-priced copy of the cart in sync with the local cart (debounced).
 * Returns `cart: null` until the first validation finishes.
 */
export function useValidatedCart() {
  const hydrated = useCartHydrated();
  const lines = useCart((s) => s.lines);
  const fulfilment = useCart((s) => s.fulfilment);
  const couponCode = useCart((s) => s.couponCode);
  const pincode = useCart((s) => s.pincode);
  const syncPrices = useCart((s) => s.syncPrices);

  const [cart, setCart] = useState<PricedCart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await validateCart({
        lines: lines.map((l) => ({
          key: l.key,
          productId: l.productId,
          size: l.size,
          sugar: l.sugar,
          ice: l.ice,
          instructions: l.instructions,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        couponCode,
        fulfilment,
        pincode: pincode.length === 6 ? pincode : "",
      }).catch(() => ({ ok: false as const, error: "Network problem – check your connection." }));
      if (id !== seq.current) return; // a newer request is in flight
      setLoading(false);
      if (res.ok) {
        setCart(res.cart);
        setError(null);
        const changed = Object.fromEntries(
          res.cart.lines.filter((l) => l.priceChanged).map((l) => [l.key, l.unitPrice]),
        );
        if (Object.keys(changed).length) syncPrices(changed);
      } else {
        setError(res.error);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [hydrated, lines, fulfilment, couponCode, pincode, syncPrices, nonce]);

  return { hydrated, cart, error, loading, refresh: () => setNonce((n) => n + 1) };
}
