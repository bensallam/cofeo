import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";

/**
 * Locale-prefixed equivalents (`/fr/cart`, `/en/checkout`, ...) are
 * what actually resolve — `localePrefix: "always"` in i18n/routing.ts
 * means the bare paths below never render a page on their own, but
 * are kept too for any crawler that doesn't expand the wildcard.
 * There's no customer account/login system in this app (guest
 * checkout only — see lib/actions/checkout-actions.ts), so there's no
 * private/account route to add here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/*/cart", "/*/checkout", "/api/"],
    },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
