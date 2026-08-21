import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";
import { EMPTY_CART, type Cart, type CartItem } from "@/lib/woocommerce/cart-types";

export { EMPTY_CART, type Cart, type CartItem };

/**
 * Minimal slice of the Store API cart item shape — verified live
 * against a real add-item response (Phase 6 mutation test), not
 * guessed. Brand/condition are deliberately not carried into the
 * cart: the Store API's cart item response has no taxonomy/attribute
 * fields (unlike /products), only `name`/`sku`/`images`/`prices`. Re-
 * fetching each product just to show a badge in the cart isn't worth
 * an extra request per line item for this phase.
 */
type StoreApiCartItem = {
  key: string;
  id: number;
  name: string;
  sku: string;
  quantity: number;
  quantity_limits: {
    minimum: number;
    maximum: number;
    multiple_of: number;
    editable: boolean;
  };
  permalink: string;
  images: { src: string; alt: string }[];
  prices: {
    price: string;
    regular_price: string;
    currency_minor_unit: number;
  };
  totals: {
    line_subtotal: string;
    line_total: string;
    currency_minor_unit: number;
  };
};

type StoreApiCart = {
  items: StoreApiCartItem[];
  items_count: number;
  totals: {
    total_items: string;
    total_discount: string;
    total_tax: string;
    /** null when no shipping rate has been calculated yet (no/invalid
     * city set) — distinct from "0", a real resolved free rate. */
    total_shipping: string | null;
    total_price: string;
    currency_minor_unit: number;
    currency_code: string;
  };
  errors?: { code: string; message: string }[];
};

function toDecimal(minorUnitsAmount: string, minorUnit: number): number {
  return Number(minorUnitsAmount) / 10 ** minorUnit;
}

/** Store API gives no direct product page link for a cart item beyond
 * `permalink` (the WordPress URL, not our own route) — the slug is
 * extracted from it so cart line items can still link back to
 * `/machines/[slug]` on our own site rather than the WP origin. */
function slugFromPermalink(permalink: string): string {
  const trimmed = permalink.replace(/\/$/, "");
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

function mapCart(raw: StoreApiCart): Cart {
  const minorUnit = raw.totals.currency_minor_unit;
  return {
    items: raw.items.map((item) => ({
      key: item.key,
      productId: item.id,
      slug: slugFromPermalink(item.permalink),
      name: item.name,
      image: item.images[0] && { src: item.images[0].src, alt: item.images[0].alt || item.name },
      quantity: item.quantity,
      quantityMin: item.quantity_limits.minimum,
      quantityMax: item.quantity_limits.maximum,
      unitPrice: toDecimal(item.prices.price, item.prices.currency_minor_unit),
      lineSubtotal: toDecimal(item.totals.line_subtotal, item.totals.currency_minor_unit),
      lineTotal: toDecimal(item.totals.line_total, item.totals.currency_minor_unit),
    })),
    itemsCount: raw.items_count,
    subtotal: toDecimal(raw.totals.total_items, minorUnit),
    discount: toDecimal(raw.totals.total_discount, minorUnit),
    tax: toDecimal(raw.totals.total_tax, minorUnit),
    shippingCost:
      raw.totals.total_shipping === null ? null : toDecimal(raw.totals.total_shipping, minorUnit),
    total: toDecimal(raw.totals.total_price, minorUnit),
    currency: raw.totals.currency_code,
  };
}

/**
 * Maps a WooCommerce Store API error `code` to one of this app's own
 * normalized ERROR_CODES — the raw WooCommerce code/message never
 * reaches a component or the client. Anything not recognized falls
 * back to SERVER_ERROR rather than guessing.
 *
 * `invalid_quantity` (WooCommerce's code when a requested quantity
 * exceeds `quantity_limits.maximum` — verified live against
 * /cart/update-item, message: "The maximum quantity of ... is 3") is
 * a stock-ceiling error from the customer's perspective just as much
 * as the `*_out_of_stock` codes from /cart/add-item are, even though
 * WooCommerce names it differently. Both map to OUT_OF_STOCK.
 */
function mapCartErrorCode(wooCode: string): "OUT_OF_STOCK" | "VALIDATION_ERROR" | "SERVER_ERROR" {
  if (wooCode.includes("stock") || wooCode.includes("invalid_quantity")) return "OUT_OF_STOCK";
  if (wooCode.includes("invalid_key") || wooCode.includes("cart_item")) {
    return "VALIDATION_ERROR";
  }
  return "SERVER_ERROR";
}

export type CartResult = { cart: Cart; cartToken: string; nonce: string };

type CartApiHeaders = { cartToken?: string; nonce?: string };

/**
 * Low-level Store API cart call. Framework-agnostic (no Next.js
 * cookies() coupling) — takes and returns the Cart-Token/Nonce as
 * plain values so the caller decides where they're persisted. Every
 * call is `cache: "no-store"`, matching the Store API's own
 * `Cache-Control: no-store` on /cart (confirmed live).
 */
async function cartApiRequest(
  path: string,
  init: { method?: string; body?: unknown; headers?: CartApiHeaders },
): Promise<CartResult> {
  const url = new URL(`/wp-json/wc/store/v1${path}`, serverEnv.WORDPRESS_API_URL);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.headers?.cartToken) headers["Cart-Token"] = init.headers.cartToken;
  if (init.headers?.nonce) headers["Nonce"] = init.headers.nonce;
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
    throw new AppError("NETWORK_ERROR", "Failed to reach the Store API cart", { cause });
  }

  const cartToken = response.headers.get("Cart-Token") ?? init.headers?.cartToken ?? "";
  const nonce = response.headers.get("Nonce") ?? init.headers?.nonce ?? "";

  if (!response.ok) {
    let code = "unknown";
    let wooMessage = "";
    try {
      const errorBody = (await response.json()) as { code?: string; message?: string };
      code = errorBody.code ?? "unknown";
      wooMessage = errorBody.message ?? "";
    } catch {
      // Non-JSON error body (e.g. a raw 5xx HTML page) — fall through
      // to SERVER_ERROR via the "unknown" code below.
    }
    // `wooMessage` is never shown to the user directly (it's raw,
    // English, and versioned by WooCommerce, not this app's i18n) —
    // it's kept only so a stock-ceiling caller can best-effort parse
    // the number out of it when no cart-derived `quantityMax` is
    // available yet (e.g. a first-ever add that overshoots stock).
    throw new AppError(mapCartErrorCode(code), "Cart operation failed", {
      cause: { status: response.status, wooCode: code, wooMessage },
    });
  }

  const data = (await response.json()) as StoreApiCart;
  return { cart: mapCart(data), cartToken, nonce };
}

export function fetchCart(cartToken?: string): Promise<CartResult> {
  return cartApiRequest("/cart", { headers: { cartToken } });
}

export function addCartItem(params: {
  cartToken?: string;
  nonce: string;
  productId: number;
  quantity: number;
}): Promise<CartResult> {
  return cartApiRequest("/cart/add-item", {
    method: "POST",
    headers: { cartToken: params.cartToken, nonce: params.nonce },
    body: { id: params.productId, quantity: params.quantity },
  });
}

export function updateCartItemQuantity(params: {
  cartToken: string;
  nonce: string;
  key: string;
  quantity: number;
}): Promise<CartResult> {
  return cartApiRequest("/cart/update-item", {
    method: "POST",
    headers: { cartToken: params.cartToken, nonce: params.nonce },
    body: { key: params.key, quantity: params.quantity },
  });
}

export function removeCartItem(params: {
  cartToken: string;
  nonce: string;
  key: string;
}): Promise<CartResult> {
  return cartApiRequest("/cart/remove-item", {
    method: "POST",
    headers: { cartToken: params.cartToken, nonce: params.nonce },
    body: { key: params.key },
  });
}

export type CheckoutAddress = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  address1: string;
};

/**
 * Sets the cart's shipping (and mirrored billing) address, which is
 * what actually triggers WooCommerce to compute shipping_rates via the
 * Phase 7 city-rate resolver. Country is always "MA" — this app has no
 * other delivery country. No price is computed here or anywhere in
 * this app; whatever `totals.total_shipping` comes back in the result
 * is the only number ever shown or used. `state`/`postcode` are always
 * sent empty — WooCommerce's own `woocommerce_get_country_locale`
 * filter (custom plugin) declares both not required for Morocco, so
 * this app never collects or fabricates them.
 */
export function updateCartCustomer(params: {
  cartToken: string;
  nonce: string;
  address: CheckoutAddress;
}): Promise<CartResult> {
  const shared = {
    first_name: params.address.firstName,
    last_name: params.address.lastName,
    address_1: params.address.address1,
    address_2: "",
    city: params.address.city,
    state: "",
    postcode: "",
    country: "MA",
    phone: params.address.phone,
  };

  return cartApiRequest("/cart/update-customer", {
    method: "POST",
    headers: { cartToken: params.cartToken, nonce: params.nonce },
    body: {
      shipping_address: shared,
      billing_address: shared,
    },
  });
}
