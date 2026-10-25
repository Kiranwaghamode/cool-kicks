"use client";

import { MotionConfig } from "motion/react";

/** Respect the visitor's reduced-motion setting for every Motion animation. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
