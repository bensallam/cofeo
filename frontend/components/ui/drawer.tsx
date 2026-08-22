"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/design/cn";

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Slides in from the logical end (`inset-inline-end`, so it's the right
 * side in LTR and the left side in RTL automatically) with an RTL-aware
 * transform. Escape-to-close plus a real focus trap: focus moves into
 * the panel on open, Tab/Shift+Tab cycle within it, and focus returns
 * to whatever triggered it on close. (Previously visual-foundation-only
 * per the Phase 2 scope decision — hardened now that MobileNav is its
 * first real production usage.)
 */
export function Drawer({ isOpen, onClose, title, children, className }: DrawerProps) {
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<Element | null>(null);
  // Portaled to document.body: the header pill's backdrop-blur (a
  // backdrop-filter) makes it a containing block for any `fixed`
  // descendant per the CSS spec, which broke this drawer's fixed
  // inset-0 wrapper — it was being sized/positioned against the 64px
  // header bar instead of the viewport. Portaling escapes that.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-50", isOpen ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!isOpen}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-gray-1000/40 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 end-0 flex w-full max-w-sm flex-col gap-4 overflow-y-auto bg-surface-elevated p-6",
          "shadow-(--shadow-elevated) transition-transform duration-300 ease-(--ease-precise)",
          "focus:outline-none",
          isOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
          className || null,
        )}
      >
        <h2 id={titleId} className="text-heading-s font-medium text-text-primary">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
