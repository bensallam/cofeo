import type { Locale } from "@/i18n/routing";

const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-MA",
  ar: "ar-MA",
  en: "en-MA",
};

/** WooCommerce's `date_created` is a naive ISO string in site-local time
 * (no timezone suffix) — passed straight to `Date`, matching how the
 * site's own admin displays the same value, not converted to the
 * visitor's own timezone. */
export function formatOrderDate(dateIso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(dateIso));
}
