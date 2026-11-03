"use client";

import { useEffect, useRef, useState } from "react";
import { useBulkCart, useBulkCartHydrated } from "@/lib/bulk-cart-store";
import { validateBulkCart, type CheckoutOptions } from "@/server/actions/business/orders";
import type { PricedBulkCart } from "@/server/wholesale";

/** Server-priced copy of the bulk cart, re-validated (debounced) whenever it changes. */
export function useValidatedBulkCart() {
  const hydrated = useBulkCartHydrated();
  const lines = useBulkCart((s) => s.lines);
  const fulfilment = useBulkCart((s) => s.fulfilment);
  const addressId = useBulkCart((s) => s.addressId);
  const syncPrices = useBulkCart((s) => s.syncPrices);

  const [cart, setCart] = useState<PricedBulkCart | null>(null);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await validateBulkCart({
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
        fulfilment,
        addressId,
      }).catch(() => ({ ok: false as const, error: "Network problem – check your connection." }));
      if (id !== seq.current) return;
      setLoading(false);
      if (res.ok && res.data) {
        setCart(res.data.cart);
        setOptions(res.data.options);
        setError(null);
        const changed = Object.fromEntries(res.data.cart.lines.filter((l) => l.priceChanged).map((l) => [l.variantId, l.unitPrice]));
        if (Object.keys(changed).length) syncPrices(changed);
      } else if (!res.ok) setError(res.error);
    }, 300);
    return () => clearTimeout(t);
  }, [hydrated, lines, fulfilment, addressId, syncPrices, nonce]);

  return { hydrated, cart, options, error, loading, refresh: () => setNonce((n) => n + 1) };
}
