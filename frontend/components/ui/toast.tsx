"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/design/cn";
import { DURATION, EASE_PRECISE } from "@/lib/design/motion";

const VARIANT = {
  default: "border-border text-text-primary",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  error: "border-error text-error",
} as const;

type ToastProps = {
  isVisible: boolean;
  message: string;
  variant?: keyof typeof VARIANT;
};

/**
 * Visual foundation only — a single controlled toast. A global
 * queue/provider is a real feature (needs app-wide state), deferred
 * to whichever phase first has something to actually notify about.
 */
export function Toast({ isVisible, message, variant = "default" }: ToastProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: DURATION.base, ease: EASE_PRECISE }}
          className={cn(
            "rounded-(--radius-control) border bg-surface-elevated px-4 py-3 text-body-s shadow-(--shadow-elevated)",
            VARIANT[variant],
          )}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
