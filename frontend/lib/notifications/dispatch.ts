import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { publicEnv } from "@/config/env";
import { locales, defaultLocale, type Locale } from "@/i18n/routing";
import {
  COFEO_STATUS_KEYS,
  COFEO_STATUS_META_KEY,
  resolveCofeoStatus,
  type CofeoStatusKey,
} from "@/lib/woocommerce/order-status";
import { getMailer } from "@/lib/notifications/mailer";
import { renderOrderStatusEmail } from "@/lib/notifications/templates";

/** Set once a checkout has captured which locale the customer was
 *  actively using — see lib/woocommerce/checkout.ts's placeOrder(). No
 *  other reliable, non-fabricated signal exists for this (no
 *  account-level locale preference is stored anywhere in this app). */
const LOCALE_META_KEY = "_cofeo_locale";

/** Idempotency guard (Phase 4B, Part 3): the last COFEO status a
 *  notification was actually sent for. Read-before-send, written
 *  only after a confirmed successful send — the same "small piece of
 *  state on the order itself" pattern the legacy `_cofeo_order_status`
 *  meta already used, not a new storage layer. */
const NOTIFIED_META_KEY = "_cofeo_last_notified_status";

/**
 * NEW is deliberately excluded: the customer already sees their order
 * immediately and synchronously at checkout, on /order-confirmation
 * (lib/woocommerce/order.ts's getOrderByKey, rendered right there in
 * the browser) — a duplicate "your order was received" email would be
 * redundant with a page the customer is already looking at. Every
 * status a human (the admin) or the checkout's own payment gateway can
 * still move the order to afterward is notifiable.
 */
const NOTIFIABLE_STATUSES: readonly CofeoStatusKey[] = [
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

type RawOrderForNotification = {
  id: number;
  number: string;
  status: string;
  order_key: string;
  billing: { first_name: string; last_name: string; email: string; phone: string };
  meta_data?: { key: string; value: unknown }[];
};

export type DispatchResult =
  | { outcome: "skipped"; reason: "order_not_found" | "not_notifiable" | "duplicate" | "no_email" }
  | { outcome: "sent"; status: CofeoStatusKey }
  | { outcome: "failed"; status: CofeoStatusKey; error: string };

function findMeta(order: RawOrderForNotification, key: string): unknown {
  return order.meta_data?.find((entry) => entry.key === key)?.value;
}

function isCofeoStatusKey(value: unknown): value is CofeoStatusKey {
  return typeof value === "string" && (COFEO_STATUS_KEYS as readonly string[]).includes(value);
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * The one entry point the order-status webhook route calls. Takes only
 * an order id — deliberately never trusts a status value supplied by
 * the caller (see app/api/webhooks/order-status-changed/route.ts's
 * docblock): the order is always re-fetched fresh here, the same
 * "never trust the caller, re-fetch and verify" principle
 * lib/woocommerce/order-status-mutation.ts already applies to writes,
 * applied here to this read/notify path.
 *
 * Never throws — every failure mode (order not found, no email on
 * file, the mailer itself failing) returns a `DispatchResult` instead,
 * so a caller can always respond to the webhook and log the outcome
 * without a try/catch of its own. This is what makes notification
 * failure structurally unable to affect order status: nothing in this
 * function, or anything it calls, ever writes to the order's `status`
 * field.
 */
export async function handleOrderStatusChanged(orderId: number): Promise<DispatchResult> {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { outcome: "skipped", reason: "order_not_found" };
  }

  let order: RawOrderForNotification;
  try {
    order = await wcRestFetch<RawOrderForNotification>(`/orders/${orderId}`);
  } catch {
    return { outcome: "skipped", reason: "order_not_found" };
  }
  if (!order || typeof order.status !== "string") {
    return { outcome: "skipped", reason: "order_not_found" };
  }

  const metaCofeoStatus = findMeta(order, COFEO_STATUS_META_KEY);
  const newStatus = resolveCofeoStatus(
    order.status,
    typeof metaCofeoStatus === "string" ? metaCofeoStatus : null,
  );

  if (!NOTIFIABLE_STATUSES.includes(newStatus)) {
    return { outcome: "skipped", reason: "not_notifiable" };
  }

  const lastNotified = findMeta(order, NOTIFIED_META_KEY);
  const previousCofeoStatus = isCofeoStatusKey(lastNotified) ? lastNotified : null;

  if (previousCofeoStatus === newStatus) {
    return { outcome: "skipped", reason: "duplicate" };
  }

  const customerEmail = order.billing.email;
  if (!customerEmail) {
    await writeNotificationNote(orderId, `COFEO notification skipped for ${newStatus}: no customer email on file.`);
    return { outcome: "skipped", reason: "no_email" };
  }

  const localeMeta = findMeta(order, LOCALE_META_KEY);
  const locale: Locale = isLocale(localeMeta) ? localeMeta : defaultLocale;

  const trackingUrl = new URL(`/${locale}/order-confirmation`, publicEnv.NEXT_PUBLIC_SITE_URL);
  trackingUrl.searchParams.set("order", String(order.id));
  trackingUrl.searchParams.set("key", order.order_key);

  const message = await renderOrderStatusEmail({
    orderId: order.id,
    orderNumber: order.number,
    customerName: [order.billing.first_name, order.billing.last_name].filter(Boolean).join(" "),
    customerEmail,
    customerPhone: order.billing.phone,
    locale,
    previousCofeoStatus,
    newCofeoStatus: newStatus,
    trackingUrl: trackingUrl.toString(),
  });

  const mailer = getMailer();
  let result;
  try {
    result = await mailer.send(message);
  } catch (cause) {
    result = { success: false as const, error: cause instanceof Error ? cause.message : "unknown mailer error" };
  }

  if (!result.success) {
    await writeNotificationNote(
      orderId,
      `COFEO notification FAILED: EMAIL for ${newStatus} to ${customerEmail} — ${result.error}`,
    );
    return { outcome: "failed", status: newStatus, error: result.error };
  }

  await writeNotificationNote(orderId, `COFEO notification sent: EMAIL for ${newStatus} to ${customerEmail}`);
  await updateLastNotifiedStatus(orderId, newStatus);

  return { outcome: "sent", status: newStatus };
}

/** Best-effort audit trail — reuses the exact order-notes mechanism
 *  class-cofeo-order-status.php's own write_note() already established
 *  for status-change audit notes; this is a second, distinctly-labeled
 *  kind of note ("COFEO notification: ...") for the notification layer
 *  specifically, not a duplicate of that one. Never throws: a failure
 *  to log is observable only via the server's own logs, and must never
 *  cascade into a bigger failure (Part 10). */
async function writeNotificationNote(orderId: number, note: string): Promise<void> {
  try {
    await wcRestFetch(`/orders/${orderId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, customer_note: false }),
    });
  } catch (cause) {
    console.error(`COFEO notification: failed to write order note for order #${orderId}`, cause);
  }
}

/** Best-effort — if this write itself fails, the worst case on the
 *  next real status change is one duplicate notification, never a
 *  lost one, and never any effect on the order's actual status. */
async function updateLastNotifiedStatus(orderId: number, status: CofeoStatusKey): Promise<void> {
  try {
    await wcRestFetch(`/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta_data: [{ key: NOTIFIED_META_KEY, value: status }] }),
    });
  } catch (cause) {
    console.error(`COFEO notification: failed to update ${NOTIFIED_META_KEY} for order #${orderId}`, cause);
  }
}
