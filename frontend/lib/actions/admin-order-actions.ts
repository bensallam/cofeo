"use server";

/**
 * The only thing a browser can actually reach for an order-status
 * mutation. Everything else in lib/woocommerce/order-status-mutation.ts
 * is pure business logic that trusts whatever `AdminAuthContext` it's
 * handed — this file is what's responsible for constructing that
 * context from a real, verified admin session, and it does not have one
 * to work with yet: COFEO has no authentication surface at all today
 * (no session cookie, no login route, no user/role model — confirmed by
 * inspecting the app before writing this).
 *
 * `getAdminAuthContext()` below is the single, explicit connection point
 * for Phase 3+: once a real admin authentication mechanism exists, that
 * is the only place this file should change — read the verified session
 * there and return a real `AdminAuthContext`. Until then it always
 * returns `null`, and `updateOrderStatusAction` always answers
 * UNAUTHORIZED as a result, for every caller including a legitimate
 * future admin. This is deliberate: inventing a header check, a query
 * param, or a client-supplied role flag here would be exactly the "fake
 * client-side authorization mechanism" this phase must not build, and
 * would be worse than not shipping the feature yet.
 */
import {
  transitionOrderCofeoStatus,
  type AdminAuthContext,
  type MutationResult,
} from "@/lib/woocommerce/order-status-mutation";
import type { CofeoStatusKey } from "@/lib/woocommerce/order-status";

/**
 * Always returns `null` — see the file-level docblock. Not a TODO left
 * to chance: this is the named seam a real implementation replaces.
 */
async function getAdminAuthContext(): Promise<AdminAuthContext | null> {
  return null;
}

export async function updateOrderStatusAction(
  orderId: number,
  requestedStatus: CofeoStatusKey,
): Promise<MutationResult> {
  const auth = await getAdminAuthContext();
  return transitionOrderCofeoStatus(orderId, requestedStatus, auth);
}
