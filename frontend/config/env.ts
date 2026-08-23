import { z } from "zod";

/**
 * Server-only environment. Importing this from a Client Component is a
 * build error by design (no "use client" escape hatch here) — WooCommerce
 * credentials must never reach the browser bundle.
 */
const serverEnvSchema = z.object({
  WORDPRESS_API_URL: z.url(),
  // Optional: no live WooCommerce REST credentials are configured for
  // this environment right now (see docs/development-environment.md).
  // The Store API (public, no auth) is unaffected — only lib/woocommerce
  // rest-client.ts, which needs these, degrades to a clear error instead
  // of crashing at import time.
  WC_CONSUMER_KEY: z.string().optional(),
  WC_CONSUMER_SECRET: z.string().optional(),
  // Signs/verifies the session cookie (lib/auth/session.ts) — unlike
  // the WC credentials above, this is not optional: an app that can
  // silently run with no way to verify a session's authenticity has
  // no real session security at all.
  SESSION_SECRET: z.string().min(32),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export const serverEnv = serverEnvSchema.parse({
  WORDPRESS_API_URL: process.env.WORDPRESS_API_URL,
  WC_CONSUMER_KEY: process.env.WC_CONSUMER_KEY,
  WC_CONSUMER_SECRET: process.env.WC_CONSUMER_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
