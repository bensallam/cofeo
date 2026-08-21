"use client";

import { MotionConfig } from "motion/react";

/**
 * `reducedMotion="user"` makes every Motion component in the tree
 * respect prefers-reduced-motion automatically — no per-component checks.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
