"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

// Reduced motion is handled globally by <MotionConfig reducedMotion="user"> (transforms are
// skipped, only a short fade remains), so server and client always render the same markup.

/** Fades + slides children in once when scrolled into view. */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay }}
    >
      {children}
    </m.div>
  );
}

/** Grid whose children fade up as each one scrolls into view (small per-column delay). */
export function StaggerGrid({ children, className, eager = 4 }: { children: ReactNode[]; className?: string; /** First N items render visible (no entrance) to keep LCP fast. */ eager?: number }) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <m.div
          key={i}
          className="h-full"
          initial={i < eager ? false : { opacity: 0, y: 22, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.21, 0.6, 0.35, 1], delay: (i % 4) * 0.07 }}
        >
          {child}
        </m.div>
      ))}
    </div>
  );
}
