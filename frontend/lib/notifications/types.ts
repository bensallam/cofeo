import type { Locale } from "@/i18n/routing";
import type { CofeoStatusKey } from "@/lib/woocommerce/order-status";

/**
 * Every channel the order-status notification system knows about — not
 * every channel it can send through yet. See `IMPLEMENTED_CHANNELS`
 * below for that distinction (Phase 4B, Part 9: WhatsApp readiness
 * without a WhatsApp integration).
 */
export const NOTIFICATION_CHANNELS = ["EMAIL", "WHATSAPP"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * The channels this phase actually has a working adapter for. WhatsApp
 * is a defined, typed channel (so nothing about the event/dispatch
 * shape has to change when it's added) but deliberately has no sender
 * yet — there is no COFEO WhatsApp Business number/API to send
 * through, and none is invented here.
 */
export const IMPLEMENTED_CHANNELS: readonly NotificationChannel[] = ["EMAIL"];

/**
 * Everything a channel adapter needs to render and send one
 * notification for one order-status change — assembled once in
 * lib/notifications/dispatch.ts from a freshly re-fetched WooCommerce
 * order, never trusted from the inbound webhook payload itself (see
 * that module's docblock).
 */
export type OrderNotificationContext = {
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  locale: Locale;
  /** `null` when no prior notification is on record for this order —
   *  not the same as "the order was just created." */
  previousCofeoStatus: CofeoStatusKey | null;
  newCofeoStatus: CofeoStatusKey;
  /** Reuses the exact same order_key-based ownership mechanism
   *  `getOrderByKey` (lib/woocommerce/order.ts) already secures
   *  `/order-confirmation` with — never a new access-control scheme. */
  trackingUrl: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailerResult = { success: true } | { success: false; error: string };

/**
 * The one thing every channel adapter must implement. The order-status
 * event itself (lib/notifications/dispatch.ts) never knows or cares
 * which channel(s) end up handling it — it only depends on this
 * interface, never on a concrete mailer/WhatsApp-client implementation.
 */
export interface Mailer {
  send(message: EmailMessage): Promise<MailerResult>;
}
