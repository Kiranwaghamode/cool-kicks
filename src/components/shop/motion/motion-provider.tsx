"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Motion setup for the whole app:
 * - LazyMotion + the light `domAnimation` feature set keeps the animation bundle small
 *   (components use `m.div`, not `motion.div`; `strict` catches mistakes).
 * - reducedMotion="user" respects the visitor's reduced-motion setting everywhere.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
