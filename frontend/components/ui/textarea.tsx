import * as React from "react";
import { cn } from "@/lib/design/cn";

type TextareaProps = Omit<React.ComponentPropsWithoutRef<"textarea">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
};

/**
 * Same self-contained label/hint/error pattern as Input — the only
 * difference is the underlying element. Used where a single-line
 * input is too cramped for the expected content (e.g. a full delivery
 * address with building/floor/landmark details).
 */
export function Textarea({ label, hint, error, id, className, rows = 3, ...props }: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-body-s font-medium text-text-primary">
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        aria-describedby={cn(hintId || null, errorId || null) || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "rounded-(--radius-control) border bg-surface px-3.5 py-3 text-body text-text-primary",
          "placeholder:text-text-muted",
          "transition-colors duration-200",
          "resize-none",
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
