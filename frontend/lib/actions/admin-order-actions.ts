"use server";

/**
 * The only thing a browser can actually reach for an order-status
 * mutation. Everything else in lib/woocommerce/order-status-mutation.ts
 * is pure business logic that trusts whatever `AdminAuthContext` it's
 * handed — this file is what's responsible for constructing that
 * context from a real, verified session.
 *
 * `getAdminAuthContext()` below is the connection point Phase 2 left
 * for this: it now reads the real signed session (lib/auth/session.ts,
 * Phase 3A), but only ever returns a non-null context when that
 * session's `role` is `"ADMIN"` — a role the session itself derived
 * server-side from WordPress's own `manage_woocommerce` capability at
 * login time (see class-cofeo-auth-rest.php), never from anything a
 * client supplied. A `CUSTOMER` session, an anonymous caller, or a
 * forged/tampered cookie (its HMAC signature fails verification inside
 * `getSession` before `role` is ever read) all fall through to the
 * same `null` → UNAUTHORIZED path.
 */
import { getSession } from "@/lib/auth/session";
import {
  transitionOrderCofeoStatus,
  type AdminAuthContext,
  type MutationResult,
} from "@/lib/woocommerce/order-status-mutation";
import type { CofeoStatusKey } from "@/lib/woocommerce/order-status";

async function getAdminAuthContext(): Promise<AdminAuthContext | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return { actorId: String(session.userId), actorEmail: session.email, isAdmin: true };
}

export async function updateOrderStatusAction(
  orderId: number,
  requestedStatus: CofeoStatusKey,
): Promise<MutationResult> {
  const auth = await getAdminAuthContext();
  return transitionOrderCofeoStatus(orderId, requestedStatus, auth);
}
