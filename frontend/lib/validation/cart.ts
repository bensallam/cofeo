import { z } from "zod";

/**
 * Every Store API cart line item key observed is a 32-char lowercase
 * hex hash. Anything else is not a key WooCommerce ever issued —
 * reject before it reaches the Store API, same fail-closed discipline
 * as the product slug validator.
 */
export const cartItemKeySchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32}$/);

/**
 * Defensive sanity ceiling only — the authoritative per-product limit
 * always comes from that item's own `quantity_limits.maximum` in the
 * Store API's response, checked separately server-side. This cap just
 * stops an obviously-abusive value (e.g. 999999) from being processed
 * at all before a real cart is even consulted.
 */
export const MAX_CART_QUANTITY = 20;

export const cartQuantitySchema = z.number().int().min(1).max(MAX_CART_QUANTITY);

export const addToCartInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: cartQuantitySchema.default(1),
});

export const updateCartItemInputSchema = z.object({
  key: cartItemKeySchema,
  quantity: cartQuantitySchema,
});

export const removeCartItemInputSchema = z.object({
  key: cartItemKeySchema,
});
