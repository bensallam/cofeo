"use client";

import * as React from "react";
import { cn } from "@/lib/design/cn";
import { RequiredMark } from "@/components/ui/required-mark";

const MAX_RESULTS = 50;

type CityComboboxProps = {
  cities: string[];
  value: string;
  onChange: (city: string) => void;
  label: string;
  hint?: string;
  moreResultsHint?: string;
  error?: string;
  id?: string;
  required?: boolean;
};

/**
 * Hand-rolled WAI-ARIA combobox (editable, list autocomplete) — no
 * dependency, matching the design system's zero-dependency components.
 * Typing only ever filters; the committed value only changes on an
 * explicit selection (click or Enter on a listbox option), never on
 * every keystroke — this keeps `value` always an exact match against
 * `cities` (never an invented/partial string). On blur without a
 * matching selection, the input reverts to the last confirmed value.
 */
export function CityCombobox({
  cities,
  value,
  onChange,
  label,
  hint,
  moreResultsHint,
  error,
  id,
  required,
}: CityComboboxProps) {
  const generatedId = React.useId();
  const comboboxId = id ?? generatedId;
  const listboxId = `${comboboxId}-listbox`;
  const hintId = hint ? `${comboboxId}-hint` : undefined;
  const errorId = error ? `${comboboxId}-error` : undefined;

  const [query, setQuery] = React.useState(value);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  // Sync from an external value change (e.g. a form reset) without an
  // effect — adjusting state during render, comparing against the
  // previous prop, is the documented React pattern for this ("you
  // might not need an effect"). Local typing never triggers this,
  // since `value` only ever changes via this component's own
  // `onChange` callback after an explicit selection.
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  const allMatches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cities.filter((city) => city.toLowerCase().includes(q)) : cities;
  }, [cities, query]);
  const filtered = allMatches.slice(0, MAX_RESULTS);
  const hasMore = allMatches.length > MAX_RESULTS;

  function selectCity(city: string) {
    setQuery(city);
    onChange(city);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleBlur() {
    window.setTimeout(() => {
      setIsOpen(false);
      setQuery((current) => (cities.includes(current) ? current : value));
    }, 150);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (isOpen && activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        selectCity(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeOptionId =
    isOpen && activeIndex >= 0 && filtered[activeIndex] ? `${comboboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={comboboxId} className="text-body-s font-medium text-text-primary uppercase">
        {label}
        {required && <RequiredMark />}
      </label>
      <div className="relative">
        <input
          id={comboboxId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          aria-describedby={cn(hintId || null, errorId || null) || undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-required={required || undefined}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={hint}
          className={cn(
            "w-full rounded-(--radius-control) border bg-surface px-3.5 py-3 pe-10 text-body text-text-primary",
            "placeholder:text-text-muted transition-colors duration-200",
            error ? "border-error" : "border-border-strong focus-visible:border-bronze",
          )}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={cn(
            "pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-text-muted transition-transform duration-200",
            isOpen ? "rotate-180" : null,
          )}
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {isOpen && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-(--radius-card) border border-border bg-surface-elevated py-1.5 shadow-(--shadow-elevated)"
        >
          {filtered.map((city, index) => (
            <li
              key={city}
              id={`${comboboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                selectCity(city);
              }}
              className={cn(
                "cursor-pointer px-3.5 py-2.5 text-body-s text-text-primary",
                index === activeIndex ? "bg-surface-hover" : null,
              )}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
      {isOpen && hasMore && moreResultsHint && (
        <p className="mt-1 text-caption text-text-muted">{moreResultsHint}</p>
      )}

      {/* Visually hidden — the same text is already shown as the input's
          placeholder (matching the reference layout), but placeholder
          text alone isn't a reliable substitute for a persistent,
          programmatically-associated hint, so it stays in the
          accessibility tree via aria-describedby. */}
      {hint && !error && (
        <p id={hintId} className="sr-only">
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
