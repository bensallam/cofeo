/**
 * The one allowlist for "where a product image is allowed to come from" —
 * shared by next.config.ts (next/image's own remotePatterns) and the
 * /api/product-image trim route (which fetches the URL server-side, so it
 * needs its own check independent of next/image's). Keeping a single
 * source of truth here means the two can't drift apart into either an
 * over-permissive proxy or a broken image host.
 */
export type AllowedImageHost = {
  protocol: "http" | "https";
  hostname: string;
  port: string;
  /** remotePatterns-style glob, e.g. "/wp-content/uploads/**". */
  pathname: string;
};

export const ALLOWED_PRODUCT_IMAGE_HOSTS: AllowedImageHost[] = [
  {
    protocol: "http",
    hostname: "localhost",
    port: "8080",
    pathname: "/wp-content/uploads/**",
  },
];

/**
 * The trim route encodes the source URL into its *path* rather than a
 * `?src=` query string — Next.js 16 only allows a literal, fixed query
 * string on local image paths (`images.localPatterns.search`), by design,
 * specifically to block a path whose query varies per request ("local
 * images with query strings ... to prevent enumeration attacks"). A
 * wildcard path segment doesn't have that restriction, so the source URL
 * is base64url-encoded into `/api/product-image/<encoded>` instead.
 * `TextEncoder`/`TextDecoder` + `btoa`/`atob` (not `Buffer`) so the same
 * helpers work from the client-side ProductImage component as well as
 * the server route. Plain `btoa(url)` isn't enough on its own — it's
 * Latin1-only, and WooCommerce media URLs can carry literal (non
 * percent-encoded) Unicode characters, e.g. an en dash "–" in a
 * filename — so the string is UTF-8-encoded to bytes first.
 */
export function encodeProductImageSource(url: string): string {
  const bytes = new TextEncoder().encode(url);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The one shared canvas ratio for the "card" rendering mode (Catalogue
 * ProductCard, Related Products) — kept here, not duplicated between the
 * /api/product-image/card route (which bakes it into the composited
 * canvas) and the frontend slot CSS (which must use the same ratio for
 * its `aspect-*` box), so the two can't silently drift apart. Plain
 * exported number, safe to import from client code (unlike
 * lib/media/product-image-pipeline.ts, which pulls in `sharp` and must
 * never be imported outside server-only files).
 */
export const CANONICAL_PRODUCT_IMAGE_RATIO = 4 / 5;

export type ProductImageMode = "natural" | "card";

/**
 * Builds the URL ProductImage requests an image from. "natural" (the
 * default, unchanged since before card mode existed) is the trimmed
 * image at its own aspect ratio — used by ProductGallery and everywhere
 * else. "card" requests the pre-composited `CANONICAL_PRODUCT_IMAGE_RATIO`
 * canvas variant — used only where every image in a row/grid must share
 * identical slot dimensions (ProductCard, Related Products). Centralized
 * here rather than inlined at each call site so the route path shape is
 * defined in exactly one place.
 */
export function buildProductImageUrl(src: string, mode: ProductImageMode = "natural"): string {
  const encoded = encodeProductImageSource(src);
  return mode === "card" ? `/api/product-image/card/${encoded}` : `/api/product-image/${encoded}`;
}

export function decodeProductImageSource(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Server-side gate for the trim route: is this an absolute URL pointing
 * at one of the allowed WordPress media hosts, with no smuggled query
 * string? Without this, /api/product-image would be an open image proxy
 * — anyone could pass an arbitrary `src` and make the server fetch it.
 */
export function isAllowedProductImageUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.search) return false;

  return ALLOWED_PRODUCT_IMAGE_HOSTS.some((allowed) => {
    const pathPrefix = allowed.pathname.replace(/\*\*$/, "");
    return (
      url.protocol === `${allowed.protocol}:` &&
      url.hostname === allowed.hostname &&
      url.port === allowed.port &&
      url.pathname.startsWith(pathPrefix)
    );
  });
}
