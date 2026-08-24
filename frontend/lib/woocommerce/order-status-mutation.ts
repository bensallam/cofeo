/**
 * Server-only order-status mutation — the one place a COFEO order
 * status is ever written from the app side. As of Phase 4A, every
 * target status maps onto a real WooCommerce status (see
 * WC_STATUS_FOR_COFEO_STATUS below and wordpress/custom-plugin/orders/
 * class-cofeo-order-status.php) — nothing here writes the legacy
 * `_cofeo_order_status` meta any more, and nothing here creates a
 * second order record; every write is a real WooCommerce REST API v3
 * call, exactly like an admin choosing a new status from the
 * WooCommerce order screen would produce.
 *
 * The audit note for a successful change is written by that same PHP
 * module's `woocommerce_order_status_changed` hook, not here — that
 * hook fires for this REST API call just as much as for an admin
 * changing status in wp-admin, so writing a note in both places would
 * duplicate it. The `X-Cofeo-Actor` header below is how that hook
 * still gets the *real* actor identity for a change that came from
 * here, rather than falling back to whichever WordPress user owns the
 * REST API consumer key/secret pair (always the same one, regardless
 * of which COFEO admin actually triggered the change).
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
 * Every COFEO status that can be a mutation *target* maps onto a real
 * WooCommerce status — three onto the new `cofeo-*` statuses Phase 4A
 * registered, the rest onto WooCommerce's own natives. NEW never
 * appears here: nothing in the transition graph ever targets it (see
 * COFEO_STATUS_DEFINITIONS), so `canTransition` already rejects any
 * attempt to "set" it before this map would ever be consulted.
 */
const WC_STATUS_FOR_COFEO_STATUS: Record<Exclude<CofeoStatusKey, "NEW">, string> = {
  CONFIRMED: "processing",
  PREPARING: "cofeo-preparing",
  SHIPPED: "cofeo-shipped",
  OUT_FOR_DELIVERY: "cofeo-outfordel",
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

  // canTransition() already guarantees this — nothing in the
  // transition graph ever targets NEW — but that isn't something
  // TypeScript can narrow from a boolean function result. Belt and
  // suspenders, not reachable in practice (see order-status.test.ts).
  if (requestedStatus === "NEW") {
    return { success: false, code: "INVALID_TRANSITION" };
  }

  const targetWcStatus = WC_STATUS_FOR_COFEO_STATUS[requestedStatus];
  try {
    await wcRestFetch(`/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        // Read by Cofeo_Order_Status::write_note() in the PHP plugin —
        // see this file's own class-level docblock for why.
        "X-Cofeo-Actor": `${auth.actorEmail} (${auth.actorId})`,
      },
      body: JSON.stringify({ status: targetWcStatus }),
    });
  } catch {
    return { success: false, code: "WOOCOMMERCE_ERROR" };
  }

  return { success: true, orderId, cofeoStatus: requestedStatus };
}
