import * as React from "react";
import { cn } from "@/lib/design/cn";
import { RequiredMark } from "@/components/ui/required-mark";

type PhoneInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  id?: string;
  required?: boolean;
};

/**
 * Visual-only composite around a plain <input> — the flag/+212 segment
 * is a static, non-interactive badge (Morocco is the only country this
 * app ever ships to; there's no real country picker to back a
 * dropdown, so this deliberately doesn't pretend to be one). `value`/
 * `onChange` behave exactly like a normal text input — the raw string
 * still flows through the same `normalizeMoroccanPhone()` server-side
 * validation as before, unchanged. Not built on top of the shared
 * `Input` component: that component owns its own label+input+hint
 * layout internally, which doesn't leave room to splice in a prefix
 * badge inside the same bordered box, so this is its own small
 * composite instead.
 */
export function PhoneInput({ label, value, onChange, placeholder, error, id, required }: PhoneInputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-body-s font-medium text-text-primary">
        {label}
        {required && <RequiredMark />}
      </label>
      <div
        dir="ltr"
        className={cn(
          "flex items-stretch overflow-hidden rounded-(--radius-control) border bg-surface transition-colors duration-200",
          error ? "border-error" : "border-border-strong",
        )}
      >
        <span
          className="flex shrink-0 items-center gap-1.5 border-e border-border bg-bg px-3 text-body text-text-primary"
          aria-hidden="true"
        >
          <span>🇲🇦</span>
          <span>+212</span>
        </span>
        <input
          id={inputId}
          type="tel"
          dir="ltr"
          inputMode="tel"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={errorId}
          aria-invalid={Boolean(error) || undefined}
          aria-required={required || undefined}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-body text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>
      {error && (
        <p id={errorId} className="text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
