"use client";

import * as React from "react";
import { cn } from "@/lib/design/cn";

type FilterDrawerProps = {
  triggerLabel: string;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
};

/**
 * Mobile-only ([lg:hidden] on the trigger) — the desktop `<aside>`
 * sidebar in the machines page is always visible at lg+, so this never
 * needs a desktop-sized state the way CheckoutModal does. Same native
 * <dialog> technique as CheckoutModal/Modal (correct focus trap,
 * Esc-to-close, backdrop covers the viewport so background scroll is
 * blocked for free) — not a new pattern, just this codebase's existing
 * one applied here. `children` is the *same* server-rendered
 * <FilterSidebar> the desktop aside uses; this component owns none of
 * the filter logic, only the open/close chrome. Every filter link
 * inside navigates immediately (plain GET links, full page load), which
 * naturally dismisses the drawer — no separate "apply" step needed.
 */
export function FilterDrawer({ triggerLabel, title, closeLabel, children }: FilterDrawerProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const [isOpen, setOpen] = React.useState(false);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-(--radius-control) border border-border-strong px-3.5 py-2 text-body-s font-medium text-text-primary transition-colors duration-200 hover:bg-surface-hover lg:hidden"
      >
        <FilterIcon />
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className={cn(
          // Same `open:flex` reasoning as CheckoutModal: an unconditional
          // `display` utility would beat the UA's `dialog:not([open])`
          // rule by origin precedence, keeping it visible after close().
          "m-0 hidden h-dvh max-h-dvh w-screen max-w-none open:flex flex-col overflow-hidden border-0 bg-surface p-0",
          "backdrop:bg-gray-1000/40",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-heading-s font-medium text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">{children}</div>
      </dialog>
    </>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
