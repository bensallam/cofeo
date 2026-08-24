import type { Locale } from "@/i18n/routing";
import type { CofeoStatusKey } from "@/lib/woocommerce/order-status";
import type { EmailMessage, OrderNotificationContext } from "@/lib/notifications/types";

/**
 * Only the slice of the message catalog this template actually reads —
 * `Checkout.orderStatus.<KEY>.{label,description}` is the EXACT same
 * key structure `components/checkout/order-status-timeline.tsx` and
 * `order-status-badge.tsx` already read from (see lib/woocommerce/
 * order-status.ts's own docblock) — reused here, never duplicated.
 * `OrderStatusEmail` is the one new namespace this phase adds, mirrored
 * identically across fr/en/ar (see messages/*.json).
 */
type OrderStatusEmailMessages = {
  Checkout: {
    orderStatus: Record<CofeoStatusKey, { label: string; description: string }>;
  };
  OrderStatusEmail: {
    subject: string;
    greeting: string;
    greetingFallback: string;
    intro: string;
    ctaLabel: string;
    footerNote: string;
    signature: string;
  };
};

/**
 * Mirrors the exact dynamic-import-by-locale pattern i18n/request.ts
 * already uses for page rendering — this module runs outside any
 * request context (an API route handler, not a React Server
 * Component), so it can't use next-intl's own `getTranslations()`,
 * which depends on request-scoped locale negotiation. Loading the
 * message JSON directly is the same underlying mechanism next-intl's
 * own config uses, applied here without the request-context wrapper.
 */
async function loadMessages(locale: Locale): Promise<OrderStatusEmailMessages> {
  const mod = (await import(`@/messages/${locale}.json`)) as { default: OrderStatusEmailMessages };
  return mod.default;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

const RTL_LOCALES: readonly Locale[] = ["ar"];

/**
 * COFEO-branded transactional email — a status update, not a full
 * order confirmation (that's /order-confirmation itself, already
 * rendered synchronously at checkout; see dispatch.ts for why NEW
 * never reaches this function). Inline styles only, no external
 * stylesheet/script/image — the safest baseline for real email client
 * rendering, and irrelevant to how LogMailer (the only sender wired up
 * this phase) handles it, but kept correct so swapping in a real
 * provider later needs no template rework.
 */
export async function renderOrderStatusEmail(ctx: OrderNotificationContext): Promise<EmailMessage> {
  const messages = await loadMessages(ctx.locale);
  const status = messages.Checkout.orderStatus[ctx.newCofeoStatus];
  const copy = messages.OrderStatusEmail;
  const isRtl = RTL_LOCALES.includes(ctx.locale);
  const dir = isRtl ? "rtl" : "ltr";
  const align = isRtl ? "right" : "left";

  const subject = interpolate(copy.subject, { number: ctx.orderNumber });
  const greeting = ctx.customerName
    ? interpolate(copy.greeting, { name: ctx.customerName })
    : copy.greetingFallback;
  const intro = interpolate(copy.intro, { number: ctx.orderNumber });

  const html = `<!doctype html>
<html lang="${ctx.locale}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#1a1611;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="background-color:#1a1611;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
        <span style="font-size:24px;letter-spacing:0.05em;color:#f4f1ea;font-weight:700;">Cofeo</span>
      </div>
      <div style="background-color:#ffffff;padding:32px;border-radius:0 0 16px 16px;text-align:${align};">
        <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 20px;font-size:16px;">${escapeHtml(intro)}</p>
        <div style="display:inline-block;background-color:#f4f1ea;border-radius:999px;padding:8px 20px;font-size:14px;font-weight:700;letter-spacing:0.03em;margin-bottom:16px;">
          ${escapeHtml(status.label)}
        </div>
        <p style="margin:0 0 28px;font-size:15px;color:#4a4438;">${escapeHtml(status.description)}</p>
        <a href="${escapeHtml(ctx.trackingUrl)}" style="display:inline-block;background-color:#1a1611;color:#f4f1ea;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:700;">
          ${escapeHtml(copy.ctaLabel)}
        </a>
        <p style="margin:32px 0 0;font-size:14px;color:#4a4438;">${escapeHtml(copy.signature)}</p>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#8a8172;text-align:center;">${escapeHtml(copy.footerNote)}</p>
    </div>
  </body>
</html>`;

  const text = [greeting, intro, status.label, status.description, copy.ctaLabel + ": " + ctx.trackingUrl, copy.signature]
    .join("\n\n");

  return { to: ctx.customerEmail, subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
