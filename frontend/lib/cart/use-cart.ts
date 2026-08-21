"use client";

import * as React from "react";
import { updateCartItemAction, removeCartItemAction, getCartAction } from "@/lib/actions/cart-actions";
import { EMPTY_CART, type Cart } from "@/lib/woocommerce/cart-types";
import type { ErrorCode } from "@/lib/errors/app-error";
import { dispatchCartUpdated, useCartUpdatedListener } from "@/lib/cart/cart-events";

/**
 * Shared mutation logic for anything that displays and edits the cart
 * (the /cart page, MiniCart). WooCommerce's response is always the
 * source of truth for the new cart state — never computed locally.
 *
 * `initialCart: null` means "fetch it client-side on mount" — used by
 * the Header's MiniCart, which deliberately never reads the cart
 * server-side (that would force `cookies()` into the root layout and
 * lose static prerendering for Homepage/design-system). The /cart
 * page instead passes a real server-fetched cart, no client fetch
 * needed.
 */
export function useCart(initialCart: Cart | null) {
  const [cart, setCart] = React.useState<Cart>(initialCart ?? EMPTY_CART);
  const [errorCode, setErrorCode] = React.useState<ErrorCode | null>(null);
  const [availableQuantity, setAvailableQuantity] = React.useState<number | undefined>(undefined);

  useCartUpdatedListener(setCart);

  React.useEffect(() => {
    if (initialCart !== null) return;
    let cancelled = false;
    getCartAction().then((fetched) => {
      if (!cancelled) setCart(fetched);
    });
    return () => {
      cancelled = true;
    };
    // Only ever runs once on mount for the "fetch on mount" case —
    // initialCart's identity is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateQuantity(key: string, quantity: number) {
    setErrorCode(null);
    setAvailableQuantity(undefined);
    const result = await updateCartItemAction({ key, quantity });
    if (result.ok) {
      setCart(result.cart);
      dispatchCartUpdated(result.cart);
    } else {
      setErrorCode(result.code);
      setAvailableQuantity(result.availableQuantity);
    }
  }

  async function remove(key: string) {
    setErrorCode(null);
    setAvailableQuantity(undefined);
    const result = await removeCartItemAction({ key });
    if (result.ok) {
      setCart(result.cart);
      dispatchCartUpdated(result.cart);
    } else {
      setErrorCode(result.code);
    }
  }

  return {
    cart,
    errorCode,
    availableQuantity,
    updateQuantity,
    remove,
    clearError: () => {
      setErrorCode(null);
      setAvailableQuantity(undefined);
    },
  };
}
