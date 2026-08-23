/**
 * Server-only order-status mutation — the one place `_cofeo_order_status`
 * (or, for statuses that map onto a real WooCommerce status, the order's
 * actual `status`) is ever written. WooCommerce remains the single
 * source of truth: nothing here creates a second order record, and every
 * write is a real WooCommerce REST API v3 call.
 *
 * This module is intentionally split from `lib/actions/admin-order-actions.ts`:
 * this file is pure, fully unit-testable business logic that takes an
 * already-established `AdminAuthContext` as a plain argument; the Server
 * Action is the only thing a browser can actually reach, and it is what's
 * responsible for constructing (or, today, refusing to construct) that
 * context from a real session. See that file's docblock for why it
 * currently always refuses.
 */
import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import {
  COFEO_STATUS_META_KEY,
  COFEO_STATUS_KEYS,
  canTransition,
  isTerminalStatus,
  mapWooCommerceStatusToCofeoStatus,
  resolveCofeoStatus,
  type CofeoStatusKey,
} from "@/lib/woocommerce/order-status";

/**
 * What a real admin session must prove before this module will act.
 * `isAdmin` is deliberately not inferred from anything here (a role
 * string, a header, a cookie) — it must already have been verified by
 * whatever constructs this object. There is no such construction site
 * in this codebase yet; see admin-order-actions.ts.
 */
export type AdminAuthContext = {
  actorId: string;
  actorEmail: string;
  isAdmin: boolean;
};

export const MUTATION_ERROR_CODES = [
  "UNAUTHORIZED",
  "ORDER_NOT_FOUND",
  "INVALID_STATUS",
  "INVALID_TRANSITION",
  "TERMINAL_ORDER",
  "WOOCOMMERCE_ERROR",
] as const;

export type MutationErrorCode = (typeof MUTATION_ERROR_CODES)[number];

export type MutationResult =
  | { success: true; orderId: number; cofeoStatus: CofeoStatusKey }
  | { success: false; code: MutationErrorCode };

type WcOrderStatusShape = {
  status: string;
  meta_data?: { key: string; value: unknown }[];
};

/**
 * The COFEO statuses that map onto a *real* WooCommerce order status
 * rather than the `_cofeo_order_status` meta refinement — writing one
 * of these changes the order's actual status, exactly like an admin
 * would from the WooCommerce order screen. PREPARING/SHIPPED/
 * OUT_FOR_DELIVERY have no WooCommerce equivalent (all three happen
 * while the WC status is still `processing`), so those write the meta
 * field only, leaving the real WC status untouched. NEW never appears
 * here: nothing in the transition graph ever targets it (see
 * COFEO_STATUS_DEFINITIONS), so `canTransition` already rejects any
 * attempt to "set" it before this map would ever be consulted.
 */
const WC_STATUS_FOR_COFEO_STATUS: Partial<Record<CofeoStatusKey, string>> = {
  CONFIRMED: "processing",
  DELIVERED: "completed",
  CANCELLED: "cancelled",
};

function isCofeoStatusKey(value: unknown): value is CofeoStatusKey {
  return typeof value === "string" && (COFEO_STATUS_KEYS as readonly string[]).includes(value);
}

/**
 * `auth.isAdmin` alone isn't trusted at face value: it must be a real
 * boolean `true` (not a truthy-but-coerced value like the string
 * `"true"`, which a less-careful boundary upstream might let through),
 * and it must be paired with a non-empty actor identity — a context
 * that claims admin rights but carries no real identity to attach to
 * the audit trail is treated as invalid rather than anonymous-but-fine.
 */
function isValidAdminAuth(auth: AdminAuthContext | null): auth is AdminAuthContext {
  if (!auth) return false;
  return auth.isAdmin === true && auth.actorId.length > 0 && auth.actorEmail.length > 0;
}

/**
 * The full guarded write path. Authorization is checked first, before
 * anything else — including before the order is even fetched — so an
 * unauthorized caller learns nothing about whether a given order id
 * exists (a plain UNAUTHORIZED either way, not a different error for
 * "unauthorized but real order" vs "unauthorized and no such order").
 *
 * The order is always re-fetched fresh from WooCommerce right before
 * validating and writing — never from a cache, never from a value the
 * caller supplied — which is what protects against two admins acting
 * on stale state at once: whichever request's fresh read happens to
 * run last simply validates against whatever the *other* request just
 * wrote, and a transition that's no longer valid from that point is
 * rejected the same as any other invalid transition. A duplicate
 * request for the same still-valid transition (e.g. a retried click)
 * is safe by construction: the write itself (a WooCommerce status/meta
 * update) is idempotent, so repeating it changes nothing further.
 */
export async function transitionOrderCofeoStatus(
  orderId: number,
  requestedStatus: CofeoStatusKey,
  auth: AdminAuthContext | null,
): Promise<MutationResult> {
  if (!isValidAdminAuth(auth)) return { success: false, code: "UNAUTHORIZED" };
  if (!Number.isInteger(orderId) || orderId <= 0) return { success: false, code: "ORDER_NOT_FOUND" };
  if (!isCofeoStatusKey(requestedStatus)) return { success: false, code: "INVALID_STATUS" };

  let raw: WcOrderStatusShape;
  try {
    raw = await wcRestFetch<WcOrderStatusShape>(`/orders/${orderId}`);
  } catch {
    return { success: false, code: "WOOCOMMERCE_ERROR" };
  }
  if (!raw || typeof raw.status !== "string") return { success: false, code: "ORDER_NOT_FOUND" };

  const wcBaseStatus = mapWooCommerceStatusToCofeoStatus(raw.status);

  // Native WooCommerce terminal statuses (completed/cancelled/failed/
  // refunded, all of which map to DELIVERED or CANCELLED) are always
  // authoritative — no meta write can contradict them, regardless of
  // what's requested.
  if (isTerminalStatus(wcBaseStatus)) {
    return { success: false, code: "TERMINAL_ORDER" };
  }

  const metaStatus = raw.meta_data?.find((entry) => entry.key === COFEO_STATUS_META_KEY)?.value;
  const currentCofeoStatus = resolveCofeoStatus(raw.status, typeof metaStatus === "string" ? metaStatus : null);

  if (!canTransition(currentCofeoStatus, requestedStatus)) {
    return { success: false, code: "INVALID_TRANSITION" };
  }

  const targetWcStatus = WC_STATUS_FOR_COFEO_STATUS[requestedStatus];
  try {
    if (targetWcStatus) {
      await wcRestFetch(`/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetWcStatus }),
      });
    } else {
      await wcRestFetch(`/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta_data: [{ key: COFEO_STATUS_META_KEY, value: requestedStatus }] }),
      });
    }
    await writeAuditNote(orderId, currentCofeoStatus, requestedStatus, auth);
  } catch {
    return { success: false, code: "WOOCOMMERCE_ERROR" };
  }

  return { success: true, orderId, cofeoStatus: requestedStatus };
}

/**
 * Audit trail via WooCommerce's own order notes (`POST /orders/{id}/
 * notes`) — the safest existing mechanism for this: visible on the
 * order in wp-admin, no second order/audit table, nothing beyond the
 * previous/new status, actor, and timestamp. `customer_note: false`
 * keeps it internal, never shown to the customer. A failure to write
 * the note does not roll back the status change itself (the note is
 * an audit trail of a write that already happened, not a precondition
 * for it) — it's caught by the caller's own try/catch and surfaces as
 * WOOCOMMERCE_ERROR, same as any other WooCommerce API failure here.
 */
async function writeAuditNote(
  orderId: number,
  from: CofeoStatusKey,
  to: CofeoStatusKey,
  auth: AdminAuthContext,
): Promise<void> {
  const note = [
    `COFEO status changed: ${from} → ${to}`,
    `Actor: ${auth.actorEmail} (${auth.actorId})`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");

  await wcRestFetch(`/orders/${orderId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note, customer_note: false }),
  });
}
