"use server";

import {
  checkoutAddressInputSchema,
  checkoutCityInputSchema,
  placeOrderInputSchema,
  splitFullName,
} from "@/lib/validation/checkout";
import { getShippingCities } from "@/lib/woocommerce/shipping-cities";
import { getCartTokenCookie, setCartTokenCookie, clearCartTokenCookie } from "@/lib/cart/cart-cookie";
import { fetchCart, updateCartCustomer, type Cart, type CheckoutAddress } from "@/lib/woocommerce/cart";
import { getCheckoutDraft, placeOrder, type PlacedOrder } from "@/lib/woocommerce/checkout";
import { AppError, type ErrorCode } from "@/lib/errors/app-error";

export type CheckoutActionResult = { ok: true; cart: Cart } | { ok: false; code: ErrorCode };
export type PlaceOrderActionResult = { ok: true; order: PlacedOrder } | { ok: false; code: ErrorCode };

/**
 * Same recovery pattern as lib/actions/cart-actions.ts (kept as a
 * small local copy rather than a shared export — this is the only
 * other Server Action file that needs it, and cart-actions.ts's
 * version being exported would make it directly client-callable for
 * no benefit).
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

/**
 * Re-validates `city` against the live backend list (never trusted
 * from the client alone — same discipline as a cart item key) and
 * pushes the given address onto the cart, returning whatever cart
 * WooCommerce's real shipping resolver computed.
 */
async function applyCheckoutAddress(city: string, address: CheckoutAddress): Promise<CheckoutActionResult> {
  let cities: string[];
  try {
    cities = await getShippingCities();
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
  if (!cities.includes(city)) {
    return { ok: false, code: "VALIDATION_ERROR" };
  }

  const current = await readCurrentCart();
  const { cartToken, nonce } = current.ok ? current : await fetchCart(undefined);

  try {
    const result = await updateCartCustomer({ cartToken, nonce, address });
    await setCartTokenCookie(result.cartToken);
    return { ok: true, cart: result.cart };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, code: error.code };
    return { ok: false, code: "SERVER_ERROR" };
  }
}

/**
 * Fires the instant a city is selected in the combobox — no separate
 * "update address" step. Only the city is required; the rest of the
 * address fields are sent empty for now (the Store API accepts a
 * partial address and still resolves shipping correctly off city+
 * country alone, confirmed live) since there's no order-placement
 * step yet for the full address to feed into.
 */
export async function updateCheckoutCityAction(cityInput: string): Promise<CheckoutActionResult> {
  const parsed = checkoutCityInputSchema.safeParse(cityInput);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  return applyCheckoutAddress(parsed.data, {
    firstName: "",
    lastName: "",
    phone: "",
    city: parsed.data,
    address1: "",
  });
}

/**
 * Full address submission — validates every field, splits the full
 * name server-side, and applies it to the cart. Not currently wired
 * to any visible submit button (no order-placement step exists yet),
 * kept ready for the phase that adds one.
 */
export async function updateCheckoutAddressAction(input: {
  fullName: string;
  phone: string;
  city: string;
  address1: string;
}): Promise<CheckoutActionResult> {
  const parsed = checkoutAddressInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const { firstName, lastName } = splitFullName(parsed.data.fullName);

  return applyCheckoutAddress(parsed.data.city, {
    firstName,
    lastName,
    phone: parsed.data.phone,
    city: parsed.data.city,
    address1: parsed.data.address1,
  });
}

/**
 * Finalizes the order. Applies the full address first (reusing the
 * exact same server-side re-validation as updateCheckoutAddressAction),
 * then re-reads the checkout draft to get a FRESH payment_methods list
 * and nonce immediately before deciding whether to place the order —
 * the client-submitted paymentMethod is never trusted on its own; if
 * it isn't in that live list (which today is always empty — no
 * gateway is enabled), the POST to Store API's /checkout is never
 * attempted at all.
 *
 * No custom idempotency/duplicate-submission layer is invented here:
 * WooCommerce's own Store API checkout route already reuses the
 * customer's existing pending/draft order on a retry rather than
 * creating a new one (confirmed directly from
 * Checkout::create_or_update_draft_order()'s source — "Reuse the
 * failed/pending order from the customer's session if one exists;
 * otherwise the POST flow would orphan it by creating a fresh order
 * on every retry"). This Server Action's job is only to not carelessly
 * fire more than one concurrent submit from a jittery UI — handled by
 * the client locking the submit control while pending (see
 * CheckoutForm), the smallest mechanism that's actually needed on top
 * of what WooCommerce already guarantees.
 *
 * `email` is optional and re-validated here via `placeOrderInputSchema`
 * (empty/omitted passes through as undefined, never an empty string —
 * see `checkoutEmailSchema`) before being forwarded to `placeOrder()`,
 * which uses it as the billing email when present and falls back to
 * COFEO's own business inbox server-side otherwise — see its docblock
 * in lib/woocommerce/checkout.ts.
 */
export async function placeOrderAction(input: {
  fullName: string;
  email?: string;
  phone: string;
  city: string;
  address1: string;
  paymentMethod: string;
}): Promise<PlaceOrderActionResult> {
  const parsed = placeOrderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const addressResult = await updateCheckoutAddressAction({
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    city: parsed.data.city,
    address1: parsed.data.address1,
  });
  if (!addressResult.ok) return { ok: false, code: addressResult.code };

  const current = await readCurrentCart();
  if (!current.ok) return { ok: false, code: "SERVER_ERROR" };

  let draftResult;
  try {
    draftResult = await getCheckoutDraft({ cartToken: current.cartToken, nonce: current.nonce });
  } catch (error) {
    if (error instanceof AppError) return { ok: false, code: error.code };
    return { ok: false, code: "SERVER_ERROR" };
  }

  // Absolute guard: never attempt the finalize POST unless the client's
  // chosen method is genuinely one Store API is currently offering.
  if (
    draftResult.draft.paymentMethods.length === 0 ||
    !draftResult.draft.paymentMethods.includes(parsed.data.paymentMethod)
  ) {
    return { ok: false, code: "VALIDATION_ERROR" };
  }

  const { firstName, lastName } = splitFullName(parsed.data.fullName);
  const address: CheckoutAddress = {
    firstName,
    lastName,
    phone: parsed.data.phone,
    city: parsed.data.city,
    address1: parsed.data.address1,
  };

  try {
    const result = await placeOrder({
      cartToken: draftResult.cartToken,
      nonce: draftResult.nonce,
      billingAddress: address,
      shippingAddress: address,
      paymentMethod: parsed.data.paymentMethod,
      email: parsed.data.email,
    });
    await setCartTokenCookie(result.cartToken);
    return { ok: true, order: result.order };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, code: error.code };
    return { ok: false, code: "SERVER_ERROR" };
  }
}
