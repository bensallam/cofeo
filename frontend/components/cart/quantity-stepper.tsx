"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";

type QuantityStepperProps = {
  quantity: number;
  min: number;
  max: number;
  /** Product name, for the group's accessible label. */
  label: string;
  onChange: (quantity: number) => Promise<void>;
  disabled?: boolean;
};

const STEP_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-(--radius-control) border border-border-strong " +
  "text-text-primary transition-colors duration-200 hover:bg-surface-hover " +
  "disabled:pointer-events-none disabled:opacity-40";

/**
 * Each instance manages its own pending state (useTransition) so one
 * line item's in-flight mutation can't be triggered again by a second
 * click, and doesn't block any other line item's controls.
 */
export function QuantityStepper({ quantity, min, max, label, onChange, disabled }: QuantityStepperProps) {
  const t = useTranslations("Cart");
  const [isPending, startTransition] = React.useTransition();
  const hintId = React.useId();
  const atMax = quantity >= max;

  function change(next: number) {
    if (next < min || next > max || next === quantity || isPending) return;
    startTransition(async () => {
      await onChange(next);
    });
  }

  const busy = isPending || disabled;

  return (
    <div className="flex flex-col gap-1">
      <div
        role="group"
        aria-label={t("quantityInputLabel", { name: label })}
        aria-describedby={atMax ? hintId : undefined}
        className="inline-flex items-center gap-3"
      >
        <button
          type="button"
          aria-label={t("decreaseQuantityLabel")}
          onClick={() => change(quantity - 1)}
          disabled={busy || quantity <= min}
          className={cn(STEP_BUTTON)}
        >
          −
        </button>
        <span className="min-w-6 text-center text-body-s tabular-nums" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          aria-label={t("increaseQuantityLabel")}
          onClick={() => change(quantity + 1)}
          disabled={busy || atMax}
          className={cn(STEP_BUTTON)}
        >
          +
        </button>
      </div>
      {/* The "+" button being disabled at the ceiling isn't itself an
       * explanation — this is the fix for the silent-failure bug: the
       * limit is stated in text, not just implied by a greyed-out
       * button (no color-only indication). */}
      {atMax && (
        <p id={hintId} className="text-caption text-text-muted">
          {t("maxAvailableQuantity", { max })}
        </p>
      )}
    </div>
  );
}
