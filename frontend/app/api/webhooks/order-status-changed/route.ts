import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/config/env";
import { handleOrderStatusChanged } from "@/lib/notifications/dispatch";

/**
 * Receives the `order.status.changed` event
 * wordpress/custom-plugin/notifications/class-cofeo-notification-dispatcher.php
 * fires on every WooCommerce order status change. Deliberately does
 * almost nothing itself — auth check, minimal body validation, then
 * hands off to lib/notifications/dispatch.ts, which re-fetches the
 * order fresh from WooCommerce and derives every fact about it itself.
 * This route body is never trusted beyond "which order id" — no status
 * value from the caller is ever used to decide what notification (if
 * any) gets sent.
 *
 * Fails closed: if no webhook secret is configured for this
 * environment, every request is rejected (401) rather than accepted
 * unauthenticated — mirrors rest-client.ts's own
 * getConfiguredCredentials(), which throws rather than silently
 * proceeding without WooCommerce credentials.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const configuredSecret = serverEnv.COFEO_NOTIFICATION_WEBHOOK_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 401 });
  }

  const providedSecret = request.headers.get("x-cofeo-webhook-secret");
  if (!providedSecret || !secretsMatch(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const orderId = extractOrderId(body);
  if (orderId === null) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
  }

  const result = await handleOrderStatusChanged(orderId);
  return NextResponse.json({ result });
}

function extractOrderId(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("orderId" in body)) return null;
  const value = (body as { orderId: unknown }).orderId;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Constant-time comparison — a plain `===` here would let a network
 *  observer distinguish "wrong secret" timings byte-by-byte. Guards
 *  the length check itself too: `timingSafeEqual` throws (rather than
 *  returning false) when the two buffers differ in length, which a
 *  wrong-length guess always would. */
function secretsMatch(provided: string, configured: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const configuredBuffer = Buffer.from(configured);
  if (providedBuffer.length !== configuredBuffer.length) return false;
  return timingSafeEqual(providedBuffer, configuredBuffer);
}
