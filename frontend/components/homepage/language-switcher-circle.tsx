"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/design/cn";

/**
 * Circular glass language control for the header pill and the mobile
 * drawer — a different visual language from the text-based
 * `LanguageSwitcher` (which stays exactly as-is for the Footer, a
 * light-surface caller this component doesn't touch). Both components
 * share the same underlying locale mechanism (next-intl's routing +
 * `router.replace(pathname, { locale })`), just with different UI.
 *
 * Flags are Unicode flag emoji, not image assets or an icon library —
 * the project has neither, and one emoji per locale is the minimal,
 * dependency-free way to render a flag glyph. Labels are each locale's
 * own name for itself (not translated per the active UI language), which
 * is the standard convention for language pickers: a French speaker
 * looking at an English UI should still see "Français", not "French".
 */
const LOCALE_META: Record<Locale, { flag: string; label: string }> = {
  fr: { flag: "🇫🇷", label: "Français" },
  ar: { flag: "🇲🇦", label: "Maroc" },
  en: { flag: "🇺🇸", label: "English" },
};

type LanguageSwitcherCircleProps = {
  className?: string;
  /** "down" (default, used in the header) opens the panel below the
   * button. "up" (used by MobileNav) opens it above instead — the
   * button sits at the bottom of the drawer via `mt-auto`, and the
   * drawer's own `overflow-y-auto` doesn't extend its scrollable area
   * for an absolutely-positioned child, so a downward panel there would
   * render mostly below the visible drawer with no way to scroll to it. */
  dropdown?: "down" | "up";
};

export function LanguageSwitcherCircle({ className, dropdown = "down" }: LanguageSwitcherCircleProps) {
  const t = useTranslations("Nav");
  const activeLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative", className || null)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t("language")}
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-surface/70 shadow-(--shadow-elevated) backdrop-blur-md transition-colors duration-200 hover:bg-surface"
      >
        <span aria-hidden="true" className="flex size-full items-center justify-center overflow-hidden rounded-full text-base leading-none">
          {LOCALE_META[activeLocale].flag}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "absolute -end-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full border border-border bg-gray-0 text-text-secondary transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        >
          <ChevronIcon />
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute end-0 z-20 w-40 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface/90 py-1 shadow-(--shadow-elevated) backdrop-blur-md",
            dropdown === "up" ? "bottom-full mb-3" : "top-full mt-3",
          )}
        >
          {routing.locales.map((locale) => {
            const isActive = locale === activeLocale;
            return (
              <button
                key={locale}
                type="button"
                role="menuitem"
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  setIsOpen(false);
                  router.replace(pathname, { locale });
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-body-s transition-colors duration-200 hover:bg-surface-hover",
                  isActive ? "font-medium text-text-primary" : "text-text-secondary",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] leading-none">
                  {LOCALE_META[locale].flag}
                </span>
                {LOCALE_META[locale].label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}
