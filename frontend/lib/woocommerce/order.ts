import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { isFallbackBillingEmail } from "@/lib/woocommerce/checkout";
import { COFEO_STATUS_META_KEY, resolveCofeoStatus, type CofeoStatusKey } from "@/lib/woocommerce/order-status";

/**
 * Minimal slice of the stable WooCommerce REST API v3 `GET /orders/{id}`
 * response shape (https://woocommerce.github.io/woocommerce-rest-api-docs/#order-properties)
 * — only the fields the confirmation page actually displays.
 */
type WcOrderV3 = {
  id: number;
  number: string;
  order_key: string;
  status: string;
  /** 0 for a guest order. Compared against a session's `wooCustomerId`
   *  by `assertCustomerOwnsOrder` (lib/auth/order-ownership.ts) — the
   *  server-side source of truth for order ownership, never a value
   *  the browser supplies. */
  customer_id: number;
  currency: string;
  date_created: string;
  total: string;
  shipping_total: string;
  discount_total: string;
  payment_method: string;
  payment_method_title: string;
  billing: { first_name: string; last_name: string; phone: string; email: string };
  shipping: { first_name: string; last_name: string; address_1: string; city: string };
  line_items: {
    name: string;
    quantity: number;
    total: string;
    image?: { src: string } | null;
  }[];
  meta_data?: { key: string; value: unknown }[];
};

export type OrderDetails = {
  orderId: number;
  orderNumber: string;
  customerId: number;
  /** Raw WooCommerce status (e.g. "processing") — for internal/debug
   *  use only. Customer-facing UI must use `cofeoStatus` instead; see
   *  lib/woocommerce/order-status.ts for why the two can differ. */
  status: string;
  cofeoStatus: CofeoStatusKey;
  dateCreated: string;
  currency: string;
  total: number;
  shippingTotal: number;
  discountTotal: number;
  subtotal: number;
  paymentMethod: string;
  paymentMethodTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress1: string;
  shippingCity: string;
  items: { name: string; quantity: number; unitPrice: number; total: number; imageSrc?: string }[];
};

function mapOrder(raw: WcOrderV3): OrderDetails {
  const items = raw.line_items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.quantity > 0 ? Number(item.total) / item.quantity : Number(item.total),
    total: Number(item.total),
    imageSrc: item.image?.src,
  }));

  const metaStatus = raw.meta_data?.find((entry) => entry.key === COFEO_STATUS_META_KEY)?.value;

  return {
    orderId: raw.id,
    orderNumber: raw.number,
    customerId: raw.customer_id,
    status: raw.status,
    cofeoStatus: resolveCofeoStatus(raw.status, typeof metaStatus === "string" ? metaStatus : null),
    dateCreated: raw.date_created,
    currency: raw.currency,
    total: Number(raw.total),
    shippingTotal: Number(raw.shipping_total),
    discountTotal: Number(raw.discount_total),
    subtotal: items.reduce((sum, item) => sum + item.total, 0),
    paymentMethod: raw.payment_method,
    paymentMethodTitle: raw.payment_method_title,
    customerName: [raw.shipping.first_name, raw.shipping.last_name].filter(Boolean).join(" "),
    customerEmail: isFallbackBillingEmail(raw.billing.email) ? "" : raw.billing.email,
    customerPhone: raw.billing.phone,
    shippingAddress1: raw.shipping.address_1,
    shippingCity: raw.shipping.city,
    items,
  };
}

/**
 * The ONLY way to reach an order's details — by its id AND its
 * `order_key` (WooCommerce's own per-order secret, the exact mechanism
 * WooCommerce's own guest "order received" page uses: `/checkout/
 * order-received/{id}/?key={order_key}`). `placeOrderAction` already
 * returns both to the client on success (see PlacedOrder in
 * lib/woocommerce/checkout.ts); the confirmation route forwards them
 * here as query params rather than trusting the id alone, which would
 * let anyone enumerate `/order-confirmation?order=124`, `125`, ... and
 * read other customers' orders.
 *
 * Returns `null` — never throws — for "no such order" AND "key doesn't
 * match" alike, deliberately not distinguishing the two: telling a
 * visitor which one it was would confirm whether a given order id
 * exists at all, a minor but needless leak.
 */
export async function getOrderByKey(orderId: number, orderKey: string): Promise<OrderDetails | null> {
  if (!Number.isInteger(orderId) || orderId <= 0 || !orderKey) return null;

  let raw: WcOrderV3;
  try {
    raw = await wcRestFetch<WcOrderV3>(`/orders/${orderId}`);
  } catch {
    return null;
  }

  if (!raw || raw.order_key !== orderKey) return null;
  return mapOrder(raw);
}

/**
 * For an *authenticated* customer's own order-detail view (Phase 3B) —
 * ownership here is established by comparing `customerId` against the
 * caller's session `wooCustomerId` (see `assertCustomerOwnsOrder` in
 * lib/auth/order-ownership.ts), not by an `order_key` the browser
 * would have to supply, so this deliberately doesn't require one. It
 * must never be called on behalf of a request without also checking
 * that ownership — the id alone is not access control by itself.
 */
export async function getOrderById(orderId: number): Promise<OrderDetails | null> {
  if (!Number.isInteger(orderId) || orderId <= 0) return null;

  try {
    const raw = await wcRestFetch<WcOrderV3>(`/orders/${orderId}`);
    if (!raw) return null;
    return mapOrder(raw);
  } catch {
    return null;
  }
}

/**
 * The customer's own order list (Phase 3B, /account/orders) — scoped
 * server-side via the WooCommerce REST API v3 `customer` query
 * parameter, never by fetching every order and filtering in the
 * browser. `wooCustomerId` must come from the caller's own verified
 * session, never a value the browser supplies directly.
 */
export async function getOrdersByCustomerId(
  wooCustomerId: number,
  params?: { page?: number; perPage?: number },
): Promise<OrderDetails[]> {
  if (!Number.isInteger(wooCustomerId) || wooCustomerId <= 0) return [];

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const query = new URLSearchParams({
    customer: String(wooCustomerId),
    page: String(page),
    per_page: String(perPage),
    orderby: "date",
    order: "desc",
  });

  try {
    const raw = await wcRestFetch<WcOrderV3[]>(`/orders?${query.toString()}`);
    return raw.map(mapOrder);
  } catch {
    return [];
  }
}
