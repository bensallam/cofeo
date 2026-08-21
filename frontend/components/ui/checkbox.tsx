import * as React from "react";
import { cn } from "@/lib/design/cn";

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<"input">, "id" | "type"> & {
  label: string;
  id?: string;
};

/**
 * Native checkbox, styled via `accent-color` rather than a fully custom
 * div-based control — keeps native keyboard/screen-reader behavior for
 * free instead of reimplementing it.
 */
export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  const generatedId = React.useId();
  const checkboxId = id ?? generatedId;

  return (
    <label htmlFor={checkboxId} className="inline-flex items-center gap-2.5">
      <input
        id={checkboxId}
        type="checkbox"
        className={cn(
          "size-4 accent-text-primary",
          "disabled:pointer-events-none disabled:opacity-40",
          className || null,
        )}
        {...props}
      />
      <span className="text-body-s text-text-primary">{label}</span>
    </label>
  );
}
