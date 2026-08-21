"use client";

import * as React from "react";
import { cn } from "@/lib/design/cn";

type CheckoutModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
};

/**
 * Same native-<dialog> technique as the design system's Modal (correct
 * focus trap, Esc-to-close, top-layer stacking, and — because the
 * ::backdrop pseudo-element covers the full viewport while open —
 * background scroll is blocked for free, no manual body-lock needed).
 * A dedicated component rather than reusing Modal directly: Modal is
 * sized for small, single-screen content (fixed max-w-md, no internal
 * scroll region), while this needs to host the full checkout form —
 * comfortably wide on desktop with its own scrollable body, and a true
 * full-screen sheet on mobile rather than a shrunk-down desktop modal.
 */
export function CheckoutModal({ isOpen, onClose, title, closeLabel, children }: CheckoutModalProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Click landed on the dialog element itself, not its content
        // (the ::backdrop area) — treat as a backdrop dismiss.
        if (event.target === dialogRef.current) onClose();
      }}
      className={cn(
        // `open:flex` (not a bare `flex`) is required here: an
        // unconditional `display` utility is an author-origin rule that
        // beats the UA stylesheet's `dialog:not([open]) { display: none }`
        // regardless of specificity (origin precedence, not specificity,
        // decides here) — that kept the dialog visible and interactive
        // after close() had already run. `open:` scopes it to `[open]`.
        "m-0 hidden h-dvh max-h-dvh w-screen max-w-none open:flex flex-col overflow-hidden border-0 bg-surface p-0",
        "sm:m-auto sm:h-auto sm:max-h-[85vh] sm:w-[90vw] sm:max-w-5xl sm:rounded-(--radius-card) sm:border sm:border-border",
        "shadow-(--shadow-elevated) backdrop:bg-gray-1000/40",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-heading-s font-medium text-text-primary">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary",
            "transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary",
          )}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">{children}</div>
    </dialog>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5" aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
