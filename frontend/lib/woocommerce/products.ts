import { storeApiFetchWithHeaders, storeApiFetch } from "./store-client";

/**
 * Minimal slice of the WooCommerce Store API product shape — only the
 * fields this app actually reads. The real response has more.
 */
type StoreApiProduct = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  short_description: string;
  images: { src: string; alt: string }[];
  is_in_stock: boolean;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    currency_minor_unit: number;
  };
  brands?: { id: number; name: string; slug: string }[];
  categories: { id: number; name: string; slug: string }[];
  tags?: { id: number; name: string; slug: string }[];
  attributes?: {
    taxonomy: string;
    terms: { id: number; name: string; slug: string }[];
  }[];
};

export type ProductCondition = "new" | "excellent" | "very-good" | "good";

export type CatalogueProduct = {
  id: number;
  slug: string;
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  condition?: ProductCondition;
  imageSrc?: string;
  imageAlt: string;
  available: boolean;
};

export type CatalogueCategory = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

export type ProductBadge = "used" | "refurbished";

export type ProductDetail = {
  id: number;
  slug: string;
  sku: string;
  brand: string;
  name: string;
  categories: { id: number; name: string; slug: string }[];
  condition?: ProductCondition;
  badges: ProductBadge[];
  images: { src: string; alt: string }[];
  description: string;
  shortDescription: string;
  price: number;
  originalPrice?: number;
  available: boolean;
  warranty: boolean;
};

type CatalogueBrand = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

// pa_condition term slugs (see wordpress/custom-plugin — condition
// attribute created for the Catalogue) mapped to the same condition
// keys ProductCard already uses.
const CONDITION_SLUG_TO_KEY: Record<string, ProductCondition> = {
  neuf: "new",
  "excellent-etat": "excellent",
  "tres-bon-etat": "very-good",
  "bon-etat": "good",
};

export const CONDITION_KEY_TO_SLUG: Record<ProductCondition, string> = {
  new: "neuf",
  excellent: "excellent-etat",
  "very-good": "tres-bon-etat",
  good: "bon-etat",
};

function toDecimal(minorUnitsAmount: string, minorUnit: number): number {
  return Number(minorUnitsAmount) / 10 ** minorUnit;
}

function mapProduct(product: StoreApiProduct): CatalogueProduct {
  const minorUnit = product.prices.currency_minor_unit;
  const activePrice = toDecimal(product.prices.price, minorUnit);
  const regularPrice = toDecimal(product.prices.regular_price, minorUnit);
  const conditionSlug = product.attributes?.find(
    (attribute) => attribute.taxonomy === "pa_condition",
  )?.terms[0]?.slug;

  return {
    id: product.id,
    slug: product.slug,
    brand: product.brands?.[0]?.name ?? "",
    name: product.name,
    price: activePrice,
    originalPrice: regularPrice > activePrice ? regularPrice : undefined,
    condition: conditionSlug ? CONDITION_SLUG_TO_KEY[conditionSlug] : undefined,
    imageSrc: product.images[0]?.src,
    imageAlt: product.images[0]?.alt || product.name,
    available: product.is_in_stock,
  };
}

// Product tag slugs that map to an orthogonal condition badge — kept
// separate from the pa_condition attribute per the Phase 5 approval
// (e.g. a "bon état" unit can additionally carry a "reconditionné"
// badge). No current demo product has these tags, so this path is
// implemented but unexercised until such content exists.
const BADGE_TAG_SLUG_TO_KEY: Record<string, ProductBadge> = {
  occasion: "used",
  reconditionne: "refurbished",
};

function extractBadges(tags: { slug: string }[] | undefined): ProductBadge[] {
  if (!tags) return [];
  const badges = tags
    .map((tag) => BADGE_TAG_SLUG_TO_KEY[tag.slug])
    .filter((badge): badge is ProductBadge => Boolean(badge));
  return Array.from(new Set(badges));
}

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&nbsp;": " ",
  "&#8217;": "’",
  "&#8216;": "‘",
  "&#8211;": "–",
  "&#8212;": "—",
  "&#8230;": "…",
};

/**
 * WooCommerce descriptions are stored as HTML and can't be trusted —
 * never rendered via dangerouslySetInnerHTML. Rather than adding an
 * HTML-sanitizer dependency, this strips all markup down to plain text
 * (with paragraph/line breaks preserved as newlines) and lets React's
 * normal text-node escaping handle the rest. Trade-off: inline
 * formatting (bold, links) in the source description is lost — an
 * acceptable simplification for Phase 5, not a security compromise.
 */
function stripHtmlToText(html: string): string {
  const withBreaks = html.replace(/<\/p>|<br\s*\/?>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]*>/g, "");
  const decoded = withoutTags.replace(
    /&(?:amp|lt|gt|quot|#039|nbsp|#8217|#8216|#8211|#8212|#8230);/g,
    (entity) => HTML_ENTITY_MAP[entity] ?? entity,
  );
  return decoded.replace(/\n{3,}/g, "\n\n").trim();
}

function mapProductDetail(product: StoreApiProduct): ProductDetail {
  const minorUnit = product.prices.currency_minor_unit;
  const activePrice = toDecimal(product.prices.price, minorUnit);
  const regularPrice = toDecimal(product.prices.regular_price, minorUnit);
  const conditionSlug = product.attributes?.find(
    (attribute) => attribute.taxonomy === "pa_condition",
  )?.terms[0]?.slug;

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    brand: product.brands?.[0]?.name ?? "",
    name: product.name,
    categories: product.categories,
    condition: conditionSlug ? CONDITION_SLUG_TO_KEY[conditionSlug] : undefined,
    badges: extractBadges(product.tags),
    images: product.images,
    description: stripHtmlToText(product.description),
    shortDescription: stripHtmlToText(product.short_description),
    price: activePrice,
    originalPrice: regularPrice > activePrice ? regularPrice : undefined,
    available: product.is_in_stock,
    // Confirmed universal business fact (all coffee machines carry a
    // 1-year warranty) — not per-product WooCommerce data.
    warranty: true,
  };
}

/**
 * Store API has no direct "get by slug" endpoint — the collection
 * endpoint's `slug` filter is the documented way to look one up.
 * Returns null (not an error) when nothing matches, so callers can
 * call notFound() rather than treating "doesn't exist" as a failure.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const params = new URLSearchParams({ slug });
  const results = await storeApiFetch<StoreApiProduct[]>(`/products?${params.toString()}`);
  const product = results[0];
  return product ? mapProductDetail(product) : null;
}

export type ProductsQuery = {
  category?: string;
  condition?: ProductCondition;
  search?: string;
  sort?: "price-asc" | "price-desc" | "newest";
  page?: number;
};

const SORT_MAP = {
  "price-asc": { orderby: "price", order: "asc" },
  "price-desc": { orderby: "price", order: "desc" },
  newest: { orderby: "date", order: "desc" },
} as const;

export const PER_PAGE = 24;

function buildParams(
  query: ProductsQuery,
  overrides: { search?: string; brand?: string; page?: number },
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("per_page", String(PER_PAGE));
  params.set("page", String(overrides.page ?? 1));
  if (query.category) params.set("category", query.category);
  if (overrides.search) params.set("search", overrides.search);
  if (overrides.brand) params.set("brand", overrides.brand);
  if (query.condition) {
    params.set("attributes[0][attribute]", "pa_condition");
    params.set("attributes[0][slug][0]", CONDITION_KEY_TO_SLUG[query.condition]);
  }
  const sort = query.sort ? SORT_MAP[query.sort] : undefined;
  if (sort) {
    params.set("orderby", sort.orderby);
    params.set("order", sort.order);
  }
  return params;
}

/**
 * WooCommerce's native product search only matches title/content/SKU
 * — not taxonomy terms. Brand names deliberately live in the
 * product_brand taxonomy (not the title), so a plain "Krups" search
 * would otherwise find nothing despite Krups products existing. This
 * checks whether the search term matches a known brand and, if so,
 * additionally queries by that brand and merges the results.
 */
async function findMatchingBrandSlug(search: string): Promise<string | undefined> {
  const brands = await getBrands();
  const needle = search.trim().toLowerCase();
  if (!needle) return undefined;
  const match = brands.find(
    (brand) =>
      brand.name.toLowerCase().includes(needle) || needle.includes(brand.name.toLowerCase()),
  );
  return match?.slug;
}

export async function getProducts(
  query: ProductsQuery,
): Promise<{ products: CatalogueProduct[]; totalPages: number; total: number }> {
  const brandSlug = query.search ? await findMatchingBrandSlug(query.search) : undefined;

  if (!brandSlug) {
    const { data, headers } = await storeApiFetchWithHeaders<StoreApiProduct[]>(
      `/products?${buildParams(query, { search: query.search, page: query.page }).toString()}`,
    );
    return {
      products: data.map(mapProduct),
      total: Number(headers.get("X-WP-Total") ?? data.length),
      totalPages: Number(headers.get("X-WP-TotalPages") ?? 1),
    };
  }

  // Brand-name match found — fetch both the title-search results and
  // the brand-filtered results, merge and dedupe, then paginate the
  // merged set ourselves (the two calls have independent, incompatible
  // pagination headers, so per-page limits are widened here instead).
  const [titleResult, brandResult] = await Promise.all([
    storeApiFetch<StoreApiProduct[]>(
      `/products?${buildParams(query, { search: query.search, page: 1 }).toString()}`,
    ),
    storeApiFetch<StoreApiProduct[]>(
      `/products?${buildParams(query, { brand: brandSlug, page: 1 }).toString()}`,
    ),
  ]);

  const seen = new Set<number>();
  const merged = [...titleResult, ...brandResult].filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });

  const page = query.page ?? 1;
  const start = (page - 1) * PER_PAGE;
  const pageItems = merged.slice(start, start + PER_PAGE);

  return {
    products: pageItems.map(mapProduct),
    total: merged.length,
    totalPages: Math.max(1, Math.ceil(merged.length / PER_PAGE)),
  };
}

export async function getCategories(): Promise<CatalogueCategory[]> {
  return storeApiFetch<CatalogueCategory[]>("/products/categories?per_page=50");
}

export async function getBrands(): Promise<CatalogueBrand[]> {
  return storeApiFetch<CatalogueBrand[]>("/products/brands?per_page=50");
}
