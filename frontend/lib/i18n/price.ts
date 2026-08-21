import type { Locale } from "@/i18n/routing";

const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-MA",
  ar: "ar-MA",
  en: "en-MA",
};

/**
 * Single source of truth for currency formatting — components must
 * never format prices themselves (brief: "do not hardcode formatting
 * inside individual product cards"). Prepared for MAD; the currency
 * code is still a parameter so this doesn't need to change if that
 * assumption is ever revisited.
 */
export function formatPrice(amount: number, locale: Locale, currency = "MAD"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(amount);
}
