"use client";

import { useEffect } from "react";
import { m } from "motion/react";

/** True after the first page has mounted – later templates are client-side navigations. */
let navigated = false;

/** Soft fade between shop pages. Skipped on the first load so the first paint is instant (LCP),
 *  and opacity-only because a transform here would break position:fixed bars inside pages. */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    navigated = true;
  }, []);
  return (
    <m.div initial={navigated ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      {children}
    </m.div>
  );
}
