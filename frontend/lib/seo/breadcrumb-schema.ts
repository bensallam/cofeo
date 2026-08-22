import { absoluteUrl } from "./url";

export type BreadcrumbInput = { label: string; href?: string };

/**
 * Converts the same `{ label, href? }[]` shape the visual Breadcrumb
 * component already renders (see components/ui/breadcrumb.tsx and its
 * callers) into schema.org BreadcrumbList — reusing that exact data
 * rather than re-deriving category/product info a second time. The
 * component never links the current (last) item, so its own absolute
 * URL is supplied separately here; a BreadcrumbList requires every
 * position to resolve to a real URL.
 */
export function buildBreadcrumbJsonLd(params: {
  locale: string;
  homeLabel: string;
  items: BreadcrumbInput[];
  currentUrl: string;
}): Record<string, unknown> {
  const { locale, homeLabel, items, currentUrl } = params;

  const trail = [
    { label: homeLabel, url: absoluteUrl(`/${locale}`) },
    ...items.map((item) => ({
      label: item.label,
      // `item.href` is already the site-relative path the Breadcrumb's
      // own next-intl <Link> receives (e.g. "/machines"), so prefixing
      // the locale here mirrors exactly what that Link resolves to.
      url: item.href ? absoluteUrl(`/${locale}${item.href}`) : currentUrl,
    })),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.label,
      item: entry.url,
    })),
  };
}
