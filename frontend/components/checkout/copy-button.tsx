"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";

type CopyButtonProps = {
  value: string;
  className?: string;
};

/**
 * `type="button"` is load-bearing here — this renders inside the
 * checkout <form>, where a bare <button> defaults to type="submit" and
 * would otherwise fire placeOrderAction on click.
 */
export function CopyButton({ value, className }: CopyButtonProps) {
  const t = useTranslations("Checkout.bankTransfer");
  const [copied, setCopied] = React.useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) —
      // the RIB/IBAN text is already visible on screen either way.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "shrink-0 rounded-(--radius-control) border px-2.5 py-1 text-caption font-medium transition-colors duration-200",
        copied
          ? "border-text-primary bg-text-primary text-text-inverse"
          : "border-button-secondary-border text-button-secondary-text hover:bg-surface-hover",
        className || null,
      )}
    >
      {copied ? t("copiedLabel") : t("copyButtonLabel")}
    </button>
  );
}
