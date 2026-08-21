import { cookies } from "next/headers";

/**
 * The Store API Cart-Token (a signed JWT carrying guest-cart identity)
 * lives ONLY in this httpOnly cookie. It is never read by client JS,
 * never included in any value returned from a Server Action to the
 * browser, and never logged. `.set`/`.delete` are only callable from a
 * Server Action (Next.js itself enforces this at runtime — calling
 * them during a Server Component render throws).
 */
const CART_TOKEN_COOKIE = "cofeo_cart_token";

// Matches the ~48h expiry observed on issued tokens (Phase 6 lifecycle
// test). Not load-bearing for correctness — an expired/invalid token
// is recovered from by starting a fresh guest cart (see
// lib/actions/cart-actions.ts), this just avoids sending a cookie the
// Store API would reject anyway.
const CART_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 48;

export async function getCartTokenCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(CART_TOKEN_COOKIE)?.value;
}

export async function setCartTokenCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function clearCartTokenCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_TOKEN_COOKIE);
}
