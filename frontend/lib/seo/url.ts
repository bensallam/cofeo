import { publicEnv } from "@/config/env";

/**
 * Builds an absolute, canonical URL from a site-relative path, reading
 * from the same NEXT_PUBLIC_SITE_URL every existing canonical/OG url
 * already uses (see e.g. the homepage's organizationJsonLd.url in
 * app/[locale]/page.tsx) — sitemap.xml and JSON-LD both require full
 * absolute URLs, unlike `<link rel="canonical">`, which browsers
 * resolve against the current document on their own.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}
