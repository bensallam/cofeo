"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/design/cn";

const LOCALE_LABEL: Record<Locale, string> = {
  fr: "FR",
  en: "EN",
  ar: "AR",
};

type LanguageSwitcherProps = {
  className?: string;
  /** Dark-surface color set — used only by the header (a dark bar);
   * defaults to the original light-surface colors so every other
   * existing caller (currently the Footer) is completely unaffected. */
  inverse?: boolean;
};

export function LanguageSwitcher({ className, inverse = false }: LanguageSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={cn("flex items-center gap-1 text-body-s", className || null)}>
      {routing.locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-1">
          {index > 0 && (
            <span className={inverse ? "text-text-inverse/40" : "text-text-muted"} aria-hidden="true">
              /
            </span>
          )}
          <button
            type="button"
            onClick={() => router.replace(pathname, { locale })}
            aria-current={locale === activeLocale ? "true" : undefined}
            className={cn(
              "px-1 transition-colors duration-200",
              inverse
                ? locale === activeLocale
                  ? "font-medium text-text-inverse"
                  : "text-text-inverse/60 hover:text-text-inverse"
                : locale === activeLocale
                  ? "font-medium text-text-primary"
                  : "text-text-muted hover:text-text-primary",
            )}
          >
            {LOCALE_LABEL[locale]}
          </button>
        </span>
      ))}
    </div>
  );
}
