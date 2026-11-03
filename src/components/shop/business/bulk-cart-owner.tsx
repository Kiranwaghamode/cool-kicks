"use client";

import { useEffect } from "react";
import { useBulkCart, useBulkCartHydrated } from "@/lib/bulk-cart-store";

/** Clears a bulk cart left in this browser by a different business account. */
export function BulkCartOwner({ businessId }: { businessId: string }) {
  const hydrated = useBulkCartHydrated();
  useEffect(() => {
    if (hydrated) useBulkCart.getState().ensureOwner(businessId);
  }, [hydrated, businessId]);
  return null;
}
