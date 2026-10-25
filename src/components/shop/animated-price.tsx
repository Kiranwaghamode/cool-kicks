"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatPaise } from "@/lib/money";

/** Price that slides when it changes. */
export function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`relative inline-flex overflow-hidden tabular-nums ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? false : { y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: "-100%", opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {formatPaise(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
