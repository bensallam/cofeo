import { absoluteUrl } from "./url";
import type { ProductDetail } from "@/lib/woocommerce/products";

/**
 * schema.org Product + Offer, built only from fields that actually
 * exist on the real WooCommerce product (see ProductDetail in
 * lib/woocommerce/products.ts) — sku/brand are omitted entirely rather
 * than emitted empty when WooCommerce has none, and nothing here
 * (ratings, review counts, a fabricated price) is invented.
 */
export function buildProductJsonLd(params: {
  product: ProductDetail;
  locale: string;
  slug: string;
}): Record<string, unknown> {
  const { product, locale, slug } = params;
  const url = absoluteUrl(`/${locale}/machines/${slug}`);
  // Same fallback generateMetadata already uses for the meta
  // description on this same page — kept identical rather than
  // reinventing a second truncation rule.
  const description = product.shortDescription || product.description.slice(0, 160) || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    ...(description ? { description } : {}),
    ...(product.images.length > 0 ? { image: product.images.map((image) => image.src) } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: product.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}
