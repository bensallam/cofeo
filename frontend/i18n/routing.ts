import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
