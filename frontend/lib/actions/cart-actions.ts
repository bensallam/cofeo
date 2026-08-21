"use server";

import {
  addToCartInputSchema,
  updateCartItemInputSchema,
  removeCartItemInputSchema,
} from "@/lib/validation/cart";
import { getCartTokenCookie, setCartTokenCookie, clearCartTokenCookie } from "@/lib/cart/cart-cookie";
import {
  fetchCart,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  EMPTY_CART,
  type Cart,
  type CartResult,
} from "@/lib/woocommerce/cart";
import { AppError, type ErrorCode } from "@/lib/errors/app-error";

/**
 * Server Actions are a public POST endpoint reachable by anyone who
 * can send the same request — not just this app's own UI. Every
 * action here re-validates its input with Zod regardless of what the
 * client claims, and never trusts a `key` it hasn't just confirmed
 * exists in *this* cart. Errors are returned as data (not thrown)
 * so a single out-of-stock line item can show an inline message
 * instead of taking down the whole page — see the Store API error
 * normalization requirement from the Phase 6 security checkpoint.
 */
export type CartActionResult = { ok: true; cart: Cart } | { ok: false; code: ErrorCode };

function toResult(cartResult: CartResult): CartActionResult {
  return { ok: true, cart: cartResult.cart };
}

function toErrorResult(error: unknown): CartActionResult {
  if (error instanceof AppError) return { ok: false, code: error.code };
  return { ok: false, code: "SERVER_ERROR" };
}

/**
 * Reads the current cart using a fresh Nonce, obtained right before
 * it's needed — never a nonce captured earlier in a prior request. If
 * the stored Cart-Token is invalid/expired, the cookie is cleared so
 * the next mutation starts a clean guest cart (recovery requirement).
 */
async function readCurrentCart(): Promise<
  { ok: true; cartToken: string; nonce: string; cart: Cart } | { ok: false }
> {
  const token = await getCartTokenCookie();
  try {
    const result = await fetchCart(token);
    return { ok: true, ...result };
  } catch {
    await clearCartTokenCookie();
    return { ok: false };
  }
}

/** Client-side mount fetch for the Header's cart badge / MiniCart contents. */
export async function getCartAction(): Promise<Cart> {
  const current = await readCurrentCart();
  return current.ok ? current.cart : EMPTY_CART;
}

export async function addToCartAction(input: { productId: number; quantity?: number }): Promise<CartActionResult> {
  const parsed = addToCartInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const current = await readCurrentCart();
  // An invalid/expired existing token was already cleared by
  // readCurrentCart(); a brand-new anonymous read still yields a
  // usable token+nonce to add the first item to a fresh cart.
  const { cartToken, nonce } = current.ok ? current : await fetchCart(undefined);

  try {
    const result = await addCartItem({
      cartToken,
      nonce,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity ?? 1,
    });
    await setCartTokenCookie(result.cartToken);
    return toResult(result);
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateCartItemAction(input: { key: string; quantity: number }): Promise<CartActionResult> {
  const parsed = updateCartItemInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const current = await readCurrentCart();
  if (!current.ok) return { ok: false, code: "VALIDATION_ERROR" };

  const targetItem = current.cart.items.find((item) => item.key === parsed.data.key);
  if (!targetItem) return { ok: false, code: "VALIDATION_ERROR" };
  if (parsed.data.quantity > targetItem.quantityMax) return { ok: false, code: "OUT_OF_STOCK" };

  try {
    const result = await updateCartItemQuantity({
      cartToken: current.cartToken,
      nonce: current.nonce,
      key: parsed.data.key,
      quantity: parsed.data.quantity,
    });
    await setCartTokenCookie(result.cartToken);
    return toResult(result);
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function removeCartItemAction(input: { key: string }): Promise<CartActionResult> {
  const parsed = removeCartItemInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const current = await readCurrentCart();
  if (!current.ok) return { ok: false, code: "VALIDATION_ERROR" };

  const targetItem = current.cart.items.find((item) => item.key === parsed.data.key);
  if (!targetItem) return { ok: false, code: "VALIDATION_ERROR" };

  try {
    const result = await removeCartItem({
      cartToken: current.cartToken,
      nonce: current.nonce,
      key: parsed.data.key,
    });
    await setCartTokenCookie(result.cartToken);
    return toResult(result);
  } catch (error) {
    return toErrorResult(error);
  }
}
