import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getProducts } from "@/lib/woocommerce/products";
import { absoluteUrl } from "@/lib/seo/url";

/**
 * Only the two real, public, canonical routes this app actually has —
 * no invented pages. /cart, /checkout, and any future account/private
 * route are deliberately absent (see app/robots.ts, which disallows
 * them outright).
 */
const STATIC_PAGES = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/machines", changeFrequency: "daily", priority: 0.8 },
] as const satisfies { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[];

/**
 * Reuses the exact `getProducts()` the Catalogue page itself calls
 * (lib/woocommerce/products.ts) rather than a second product-listing
 * query — loops its existing pagination instead of duplicating it.
 * The real catalogue is one page today, so this runs once in practice.
 */
async function getAllProductSlugs(): Promise<string[]> {
  const first = await getProducts({});
  const slugs = first.products.map((product) => product.slug);
  for (let page = 2; page <= first.totalPages; page++) {
    const { products } = await getProducts({ page });
    slugs.push(...products.map((product) => product.slug));
  }
  return slugs;
}

/**
 * One <url> entry per locale for a given site-relative path, each
 * carrying `alternates.languages` pointing at every locale variant
 * (including itself) — the exact shape Next's own "Generate a
 * localized Sitemap" example uses. Stable/canonical: the same path
 * shape generateMetadata's own `alternates.canonical` already builds
 * for this route (see the sibling page.tsx files), just resolved to
 * an absolute URL here since sitemap.xml requires one.
 */
function localizedEntries(
  path: string,
): Pick<MetadataRoute.Sitemap[number], "url" | "alternates">[] {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, absoluteUrl(`/${locale}${path}`)]),
  );
  return routing.locales.map((locale) => ({
    url: absoluteUrl(`/${locale}${path}`),
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of STATIC_PAGES) {
    entries.push(
      ...localizedEntries(page.path).map((entry) => ({
        ...entry,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      })),
    );
  }

  const slugs = await getAllProductSlugs();
  for (const slug of slugs) {
    entries.push(
      ...localizedEntries(`/machines/${slug}`).map((entry) => ({
        ...entry,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    );
  }

  return entries;
}
