import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { ALLOWED_PRODUCT_IMAGE_HOSTS } from "./lib/media/product-image-source";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // WordPress media host — required for next/image to load real
    // product images from the local WooCommerce instance. Only the
    // local dev host is allowlisted; production would need its own
    // entry when that host is known. Derived from the same list the
    // /api/product-image trim route validates against, so the two
    // can't drift apart.
    remotePatterns: ALLOWED_PRODUCT_IMAGE_HOSTS.map((host) => ({
      protocol: host.protocol,
      hostname: host.hostname,
      port: host.port,
      pathname: host.pathname,
      search: "",
    })),
    // The /api/product-image trim route takes the encoded source as a
    // path segment (see encodeProductImageSource) rather than a `?src=`
    // query string — Next 16's localPatterns.search only accepts one
    // fixed literal value, not a per-request-varying one, precisely to
    // block that pattern. A wildcard path segment isn't restricted the
    // same way. No `search` here means the route must be called with no
    // query string at all, which is how it's always built.
    // "/**" already covers /api/product-image/card/** too, but that
    // route is listed explicitly since it's a distinct route (composited
    // canvas, not the plain trim) and Next's own devtools/asset overlay
    // benefits from a pattern that doesn't rely on a human remembering
    // the nested route exists.
    localPatterns: [{ pathname: "/api/product-image/**" }, { pathname: "/api/product-image/card/**" }],
    // Next.js 16 blocks image optimization from local/loopback IPs by
    // default (SSRF hardening) — narrowly re-enabled here because the
    // WordPress media host genuinely is localhost in local dev. Not
    // meaningful in production, where the media host won't be local.
    dangerouslyAllowLocalIP: true,
  },
};

export default withNextIntl(nextConfig);
