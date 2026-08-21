import { getCartTokenCookie } from "@/lib/cart/cart-cookie";
import { fetchCart, EMPTY_CART, type Cart } from "@/lib/woocommerce/cart";

/**
 * Read-only cart lookup for Server Components (the /cart page). Not
 * used by the root layout/Header — calling this there would force
 * `cookies()` into every route in the app (Homepage, design-system),
 * losing their static prerendering. The Header's cart badge instead
 * fetches client-side after mount (see components/cart/cart-widget.tsx)
 * so the rest of the site's rendering strategy is unaffected.
 */
export async function getCurrentCart(): Promise<Cart> {
  const token = await getCartTokenCookie();
  if (!token) return EMPTY_CART;

  try {
    const { cart } = await fetchCart(token);
    return cart;
  } catch {
    // A failed cart read on page load shouldn't break the page — an
    // expired/invalid token degrades to "looks empty" rather than an
    // error state; the next mutation recovers it (see cart-actions.ts).
    return EMPTY_CART;
  }
}
