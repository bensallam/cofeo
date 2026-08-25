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
 * Phase 4D: this function is, and has always been, ADMIN-only —
 * `isValidAdminAuth()` below rejects every call before anything else
 * runs, and there is no other path anywhere in this codebase that
 * reaches WooCommerce with a status write (confirmed by repo-wide
 * search as part of that phase's own audit). Because of that, this no
 * longer applies `canTransition()`'s forward-only happy-path graph or
 * the old "a terminal order can't be touched" rule: those are the
 * *customer-facing* domain model's own invariants (still fully intact
 * and unit-tested in order-status.ts / order-status.test.ts, used
 * wherever the app reasons about what a customer should be *shown* —
 * e.g. getOrderTimeline()) — they were never meant to constrain a
 * verified human admin correcting a real mistake, any more than
 * wp-admin's own order-status dropdown does (see class-cofeo-order-status.php,
 * which stopped enforcing exactly this in the Phase 4A persistence
 * fix). An admin reaching this function may set any real COFEO status,
 * forward or backward, from or to a terminal one — identical to what
 * they could already do by using wp-admin directly instead of this
 * in-app control.
 *
 * The audit note for a successful change is written by that same PHP
 * module's `woocommerce_order_status_changed` hook, not here — that
 * hook fires for this REST API call just as much as for an admin
 * changing status in wp-admin, so writing a note in both places would
 * duplicate it. The `X-Cofeo-Actor` header below is how that hook
 * still gets the *real* actor identity for a change that came from
 * here, rather than falling back to whichever WordPress user owns the
 * REST API consumer key/secret pair (always the same one, regardless
 * of which COFEO admin actually triggered the change). The same hook
 * also records the status-history event and fires the notification
 * webhook — both entirely unaffected by, and unaware of, whether the
 * change that triggered them came from here or from wp-admin.
 *
 * This module is intentionally split from `lib/actions/admin-order-actions.ts`:
 * this file is pure, fully unit-testable business logic that takes an
 * already-established `AdminAuthContext` as a plain argument; the Server
 * Action is the only thing a browser can actually reach, and it is what's
 * responsible for constructing (or refusing to construct) that context
 * from a real session — see that file's own docblock.
 */
import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { COFEO_STATUS_KEYS, type CofeoStatusKey } from "@/lib/woocommerce/order-status";

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

export const MUTATION_ERROR_CODES = ["UNAUTHORIZED", "ORDER_NOT_FOUND", "INVALID_STATUS", "WOOCOMMERCE_ERROR"] as const;

export type MutationErrorCode = (typeof MUTATION_ERROR_CODES)[number];

export type MutationResult =
  | { success: true; orderId: number; cofeoStatus: CofeoStatusKey }
  | { success: false; code: MutationErrorCode };

type WcOrderStatusShape = {
  status: string;
};

/**
 * Every COFEO status maps onto a real WooCommerce status — three onto
 * the `cofeo-*` statuses Phase 4A registered, the rest onto
 * WooCommerce's own natives. NEW maps to `pending` (not `on-hold`,
 * the other native status that also *reads* back as NEW — `on-hold`
 * is specifically the bank-transfer gateway's own awaiting-verification
 * signal, never something an admin manually "sets" as a correction;
 * `pending` is WooCommerce's own plain "not yet handled" state and the
 * one wp-admin's own relabeled dropdown shows as "Commande reçue").
 * Phase 4D: unlike before, NEW is now a valid mutation target — an
 * admin correcting an order all the way back to received is exactly
 * as legitimate as any other correction (see this file's own
 * class-level docblock).
 */
const WC_STATUS_FOR_COFEO_STATUS: Record<CofeoStatusKey, string> = {
  NEW: "pending",
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
 * writing — never from a cache, never from a value the caller
 * supplied — primarily so ORDER_NOT_FOUND is accurate (a deleted or
 * never-existing order is caught here, not assumed). Phase 4D: this
 * fresh read is no longer used to validate the requested status
 * *against* the current one — an admin may move an order to any real
 * COFEO status regardless of where it currently sits (see this file's
 * own class-level docblock for why). A duplicate request for the same
 * status (e.g. a retried click) is safe by construction: the write
 * itself is idempotent, so repeating it changes nothing further.
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
