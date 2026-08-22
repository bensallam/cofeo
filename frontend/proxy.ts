import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isValidProductSlug } from "./lib/validation/product-slug";
import { getProductBySlug } from "./lib/woocommerce/products";

const handleI18nRouting = createMiddleware(routing);

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`
 * (see node_modules/next/dist/docs/.../proxy.md). next-intl's
 * `createMiddleware` still returns a standard NextRequest handler,
 * so it's just re-exported under the new name here.
 */
const PRODUCT_PATH = new RegExp(`^/(${routing.locales.join("|")})/machines/([^/]+)/?$`);

/**
 * next-intl's own middleware sets this exact header (see its
 * `middleware.js` — `new Headers(...); headers.set(HEADER_LOCALE_NAME,
 * locale)`) so `getRequestConfig`'s `requestLocale` in i18n/request.ts
 * knows which locale to render. It isn't part of next-intl's public
 * API surface, so the literal is reproduced here rather than reaching
 * into an internal module path — this proxy skips calling
 * `handleI18nRouting` on the 404 branch below, so without setting this
 * itself, EN/AR requests would silently render French (the default
 * locale) instead of a real 404 in the wrong language.
 */
const LOCALE_HEADER = "X-NEXT-INTL-LOCALE";

/**
 * A missing product must return a real HTTP 404, not the 200 that
 * `notFound()` alone produces here. `machines/[slug]/loading.tsx`
 * wraps the page in a Suspense boundary (an intentional, existing
 * loading state — not something this fix should remove), so Next
 * starts streaming a 200 response before the page's own `await
 * getProductBySlug()` can resolve and call `notFound()`; the status
 * is already committed by then (see Next's own docs: "Status Codes"
 * in node_modules/next/dist/docs/.../loading.md — the documented fix
 * for exactly this trade-off is to check existence here, in proxy,
 * before the response streams).
 *
 * The existence check reuses the exact same `getProductBySlug` the
 * page itself calls — not a second, parallel lookup that could drift
 * out of sync on which products count as "found" (unpublished/out of
 * stock/etc.). On a genuine network failure, this fails open (lets
 * the request through) so a transient WooCommerce hiccup can't turn
 * into a false 404 for a real product; the page's own try/catch
 * already handles that case with its error boundary.
 */
async function productExists(slug: string): Promise<boolean> {
  if (!isValidProductSlug(slug)) return false;
  try {
    return (await getProductBySlug(slug)) !== null;
  } catch {
    return true;
  }
}

export default async function proxy(request: Parameters<typeof handleI18nRouting>[0]) {
  const match = request.nextUrl.pathname.match(PRODUCT_PATH);
  if (match) {
    const [, locale, rawSlug] = match;
    const slug = decodeURIComponent(rawSlug);
    if (!(await productExists(slug))) {
      // Rewriting to the same URL still renders the page's own
      // `notFound()` → machines/[slug]/not-found.tsx UI exactly as
      // before; only the status Next sends for *this* outer response
      // changes, which is what a raw curl/devtools check reads. The
      // locale header is set explicitly since this branch bypasses
      // `handleI18nRouting` (see LOCALE_HEADER above).
      const headers = new Headers(request.headers);
      headers.set(LOCALE_HEADER, locale);
      return NextResponse.rewrite(request.nextUrl, { status: 404, request: { headers } });
    }
  }
  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
