"use client";

import { motion } from "motion/react";

/** Soft fade between shop pages (opacity only – a transform here would break position:fixed bars inside pages). */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
