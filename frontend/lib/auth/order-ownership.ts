import { getSession, type Session } from "@/lib/auth/session";

export async function getAuthenticatedCustomer(): Promise<Session | null> {
  return getSession();
}

export class OrderAccessDeniedError extends Error {
  constructor() {
    super("Order access denied");
    this.name = "OrderAccessDeniedError";
  }
}

/**
 * The one place order ownership is decided. `orderCustomerId` must
 * come from the order record itself (WooCommerce's own `customer_id`,
 * fetched server-side) — never from a value the browser supplied,
 * which is exactly the IDOR this guards against: a customer changing
 * `/orders/123` to `/orders/124` gets whatever `124`'s real
 * `customer_id` is compared against *their own* session's
 * `wooCustomerId`, not anything they control. Throws rather than
 * returning a boolean so a caller can't accidentally ignore a denial —
 * the TypeScript `asserts` return type also narrows `session` to
 * non-null for the rest of the caller's function.
 */
export function assertCustomerOwnsOrder(
  session: Session | null,
  orderCustomerId: number,
): asserts session is Session {
  if (!session || session.wooCustomerId !== orderCustomerId) {
    throw new OrderAccessDeniedError();
  }
}
