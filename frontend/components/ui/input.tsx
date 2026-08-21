import * as React from "react";
import { cn } from "@/lib/design/cn";

type InputProps = Omit<React.ComponentPropsWithoutRef<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
};

/**
 * Self-contained field: owns its label/hint/error association via a
 * generated id, so callers can't forget to wire aria-describedby.
 */
export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-body-s font-medium text-text-primary">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={cn(hintId || null, errorId || null) || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "rounded-(--radius-control) border bg-surface px-3.5 py-2.5 text-body text-text-primary",
          "placeholder:text-text-muted",
          "transition-colors duration-200",
          error ? "border-error" : "border-border-strong",
          "disabled:pointer-events-none disabled:opacity-40",
          className || null,
        )}
        {...props}
      />
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
