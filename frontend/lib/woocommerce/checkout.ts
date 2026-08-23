import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";
import type { CheckoutAddress } from "@/lib/woocommerce/cart";

/**
 * Minimal slice of the Store API checkout draft/order shape — verified
 * live against a real GET /checkout response (Phase 9). `payment_methods`
 * lives nested under `__experimentalCart`, not at the top level —
 * confirmed by direct inspection, not assumed.
 */
type StoreApiAddress = {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  email?: string;
};

/**
 * WooCommerce's Store API unconditionally requires a billing email on
 * every order (no per-country override exists, unlike state/postcode
 * — see wordpress/custom-plugin/checkout/class-cofeo-checkout-locale.php).
 * The checkout's email field is optional (customer-facing decision,
 * confirmed explicitly): when the customer provides one, it becomes
 * the order's real billing email; when they leave it empty, this
 * server-only fallback is used instead — never fabricated, never
 * guessed. This constant itself never reaches the client: this module
 * already requires server-only `serverEnv` at module scope (line 1),
 * so any accidental client-side import already fails to build, the
 * same guard the rest of this app relies on (see
 * lib/woocommerce/cart-types.ts's history).
 */
const COFEO_BUSINESS_EMAIL = "contact@cofeo.ma";

/**
 * Lets `lib/woocommerce/order.ts` tell an order's real billing email
 * apart from this fallback, so the confirmation page never displays
 * COFEO's own inbox back to a guest as "your email" — it hides that
 * row instead. A plain string export, not a secret.
 */
export function isFallbackBillingEmail(email: string): boolean {
  return email === COFEO_BUSINESS_EMAIL;
}

type StoreApiCheckoutDraft = {
  order_id: number;
  order_key: string;
  order_number: string;
  status: string;
  billing_address: StoreApiAddress;
  shipping_address: StoreApiAddress;
  payment_method: string;
  // Populated on the pre-completion draft (GET). On the completed-order
  // response (POST succeeding), WooCommerce has already cleared the
  // cart the order was created from, so this comes back `null` —
  // confirmed live, see mapPlacedOrder below.
  __experimentalCart: {
    needs_payment: boolean;
    payment_methods: string[];
    totals: {
      total_price: string;
      total_shipping: string | null;
      currency_code: string;
      currency_minor_unit: number;
    };
    items: { name: string; quantity: number }[];
  } | null;
  errors?: { code: string; message: string }[];
};

export type CheckoutDraft = {
  needsPayment: boolean;
  paymentMethods: string[];
  total: number;
  currency: string;
};

export type PlacedOrder = {
  orderId: number;
  orderKey: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  shippingCity: string;
};

function toDecimal(minorUnitsAmount: string, minorUnit: number): number {
  return Number(minorUnitsAmount) / 10 ** minorUnit;
}

function mapCheckoutDraft(raw: StoreApiCheckoutDraft): CheckoutDraft {
  const cart = raw.__experimentalCart;
  if (!cart) throw new AppError("SERVER_ERROR", "Checkout draft response was missing its cart");
  return {
    needsPayment: cart.needs_payment,
    paymentMethods: cart.payment_methods,
    total: toDecimal(cart.totals.total_price, cart.totals.currency_minor_unit),
    currency: cart.totals.currency_code,
  };
}

/**
 * On a completed order (POST /checkout succeeding), `__experimentalCart`
 * comes back `null` — WooCommerce has already cleared the cart the order
 * was created from, so there is no cart left to report totals/items for
 * (confirmed live: crashed here on every real order until this was
 * narrowed). None of that is needed anyway — the confirmation page reads
 * the real order back from the REST API v3 (lib/woocommerce/order.ts),
 * so only the top-level order fields, which are always present, are
 * mapped here.
 */
function mapPlacedOrder(raw: StoreApiCheckoutDraft): PlacedOrder {
  return {
    orderId: raw.order_id,
    orderKey: raw.order_key,
    orderNumber: raw.order_number,
    status: raw.status,
    paymentMethod: raw.payment_method,
    shippingCity: raw.shipping_address.city,
  };
}

function mapCheckoutErrorCode(wooCode: string): "VALIDATION_ERROR" | "OUT_OF_STOCK" | "SERVER_ERROR" {
  if (wooCode.includes("stock")) return "OUT_OF_STOCK";
  if (
    wooCode.includes("payment") ||
    wooCode.includes("invalid") ||
    wooCode.includes("missing") ||
    wooCode.includes("validation")
  ) {
    return "VALIDATION_ERROR";
  }
  return "SERVER_ERROR";
}

type CheckoutApiHeaders = { cartToken: string; nonce: string };

async function checkoutApiRequest(
  init: { method?: string; body?: unknown; headers: CheckoutApiHeaders },
): Promise<{ data: StoreApiCheckoutDraft; cartToken: string; nonce: string }> {
  const url = new URL("/wp-json/wc/store/v1/checkout", serverEnv.WORDPRESS_API_URL);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Cart-Token": init.headers.cartToken,
    Nonce: init.headers.nonce,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "Failed to reach the Store API checkout endpoint", { cause });
  }

  const cartToken = response.headers.get("Cart-Token") ?? init.headers.cartToken;
  const nonce = response.headers.get("Nonce") ?? init.headers.nonce;

  if (!response.ok) {
    let code = "unknown";
    try {
      const errorBody = (await response.json()) as { code?: string };
      code = errorBody.code ?? "unknown";
    } catch {
      // Non-JSON error body — fall through to SERVER_ERROR below.
    }
    throw new AppError(mapCheckoutErrorCode(code), "Checkout operation failed", {
      cause: { status: response.status },
    });
  }

  const data = (await response.json()) as StoreApiCheckoutDraft;
  return { data, cartToken, nonce };
}

/**
 * Read-only — safe to call at any time, never mutates anything. Used
 * to check `paymentMethods` before ever considering a real submit.
 */
export async function getCheckoutDraft(params: {
  cartToken: string;
  nonce: string;
}): Promise<{ draft: CheckoutDraft; cartToken: string; nonce: string }> {
  const result = await checkoutApiRequest({ headers: params });
  return { draft: mapCheckoutDraft(result.data), cartToken: result.cartToken, nonce: result.nonce };
}

/**
 * Finalizes the order — creates/updates the real WooCommerce order via
 * Store API's own draft-order reuse (see class-level note in the
 * calling Server Action for why no separate idempotency layer is
 * built here). Callers MUST have already confirmed `paymentMethod` is
 * one of the draft's own `paymentMethods` before calling this.
 *
 * `billing_address.email` priority: the caller-supplied `email` (the
 * customer's own, already validated as either empty or a real email
 * shape by `checkoutEmailSchema` before this is ever called) if given,
 * otherwise `COFEO_BUSINESS_EMAIL`. The fallback constant itself is
 * never sent to or readable by the browser regardless of which branch
 * is taken — this function runs server-only.
 */
export async function placeOrder(params: {
  cartToken: string;
  nonce: string;
  billingAddress: CheckoutAddress;
  shippingAddress: CheckoutAddress;
  paymentMethod: string;
  email?: string;
}): Promise<{ order: PlacedOrder; cartToken: string; nonce: string }> {
  const toStoreAddress = (address: CheckoutAddress): StoreApiAddress => ({
    first_name: address.firstName,
    last_name: address.lastName,
    address_1: address.address1,
    address_2: "",
    city: address.city,
    state: "",
    postcode: "",
    country: "MA",
    phone: address.phone,
  });

  const result = await checkoutApiRequest({
    method: "POST",
    headers: { cartToken: params.cartToken, nonce: params.nonce },
    body: {
      billing_address: {
        ...toStoreAddress(params.billingAddress),
        email: params.email ?? COFEO_BUSINESS_EMAIL,
      },
      shipping_address: toStoreAddress(params.shippingAddress),
      payment_method: params.paymentMethod,
      customer_note: "",
    },
  });

  return { order: mapPlacedOrder(result.data), cartToken: result.cartToken, nonce: result.nonce };
}
