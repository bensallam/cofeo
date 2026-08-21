import { getCartTokenCookie } from "@/lib/cart/cart-cookie";
import { fetchCart } from "@/lib/woocommerce/cart";
import { getCheckoutDraft } from "@/lib/woocommerce/checkout";

/**
 * Read-only, for the /checkout Server Component — entirely
 * data-driven, never assumes COD or any specific gateway exists.
 * Fails closed to an empty list rather than guessing.
 */
export async function getAvailablePaymentMethods(): Promise<string[]> {
  const token = await getCartTokenCookie();
  if (!token) return [];

  try {
    const { cartToken, nonce } = await fetchCart(token);
    const { draft } = await getCheckoutDraft({ cartToken, nonce });
    return draft.paymentMethods;
  } catch {
    return [];
  }
}
