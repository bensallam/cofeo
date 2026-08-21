"use client";

import * as React from "react";
import { cn } from "@/lib/design/cn";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Native <dialog> rather than a hand-built portal + focus-trap: it
 * gives correct focus trapping, Esc-to-close, and top-layer stacking
 * for free. Setting the `open` attribute alone does NOT get modal
 * behavior — `.showModal()` must be called imperatively, hence the
 * ref + effect below.
 */
export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
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
        "m-auto rounded-(--radius-card) border border-border bg-surface-elevated p-6 shadow-(--shadow-elevated)",
        "backdrop:bg-gray-1000/40",
        "max-w-md w-[calc(100vw-2rem)]",
        className || null,
      )}
    >
      <h2 id={titleId} className="text-heading-s font-medium text-text-primary">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
