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
  currency: string;
  date_created: string;
  total: string;
  shipping_total: string;
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
  /** Raw WooCommerce status (e.g. "processing") — for internal/debug
   *  use only. Customer-facing UI must use `cofeoStatus` instead; see
   *  lib/woocommerce/order-status.ts for why the two can differ. */
  status: string;
  cofeoStatus: CofeoStatusKey;
  dateCreated: string;
  currency: string;
  total: number;
  shippingTotal: number;
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
    status: raw.status,
    cofeoStatus: resolveCofeoStatus(raw.status, typeof metaStatus === "string" ? metaStatus : null),
    dateCreated: raw.date_created,
    currency: raw.currency,
    total: Number(raw.total),
    shippingTotal: Number(raw.shipping_total),
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
