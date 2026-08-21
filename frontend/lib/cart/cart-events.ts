"use client";

import * as React from "react";
import type { Cart } from "@/lib/woocommerce/cart-types";

/**
 * Keeps independent client-side cart surfaces (the Header's badge/
 * MiniCart, and the /cart page) in sync without a global store
 * library. The Header deliberately never reads the cart server-side
 * (see lib/cart/current-cart.ts) so Homepage/design-system keep their
 * static prerendering — this event is how it learns about a mutation
 * that happened somewhere else in the tree.
 */
const CART_UPDATED_EVENT = "cofeo:cart-updated";

export function dispatchCartUpdated(cart: Cart) {
  window.dispatchEvent(new CustomEvent<Cart>(CART_UPDATED_EVENT, { detail: cart }));
}

export function useCartUpdatedListener(onUpdate: (cart: Cart) => void) {
  React.useEffect(() => {
    function handler(event: Event) {
      onUpdate((event as CustomEvent<Cart>).detail);
    }
    window.addEventListener(CART_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CART_UPDATED_EVENT, handler);
  }, [onUpdate]);
}
