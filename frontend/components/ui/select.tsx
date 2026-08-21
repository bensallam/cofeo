import * as React from "react";
import { cn } from "@/lib/design/cn";

type SelectProps = Omit<React.ComponentPropsWithoutRef<"select">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
};

export function Select({
  label,
  hint,
  error,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-body-s font-medium text-text-primary">
        {label}
      </label>
      <select
        id={selectId}
        aria-describedby={cn(hintId || null, errorId || null) || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "rounded-(--radius-control) border bg-surface px-3.5 py-2.5 text-body text-text-primary",
          "transition-colors duration-200",
          error ? "border-error" : "border-border-strong",
          "disabled:pointer-events-none disabled:opacity-40",
          className || null,
        )}
        {...props}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
