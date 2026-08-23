import { describe, expect, it } from "vitest";
import { assertCustomerOwnsOrder, OrderAccessDeniedError } from "./order-ownership";
import type { Session } from "./session";

function makeSession(wooCustomerId: number): Session {
  return {
    userId: wooCustomerId,
    email: "customer@example.com",
    firstName: "Test",
    lastName: "Customer",
    role: "CUSTOMER",
    wooCustomerId,
    sessionGeneration: 0,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };
}

describe("assertCustomerOwnsOrder", () => {
  it("does not throw when the session's wooCustomerId matches the order's customer_id", () => {
    const session = makeSession(123);
    expect(() => assertCustomerOwnsOrder(session, 123)).not.toThrow();
  });

  it("throws when the order belongs to a different customer (the core IDOR case: /orders/123 -> /orders/124)", () => {
    const session = makeSession(123);
    expect(() => assertCustomerOwnsOrder(session, 124)).toThrow(OrderAccessDeniedError);
  });

  it("throws for an anonymous caller (no session)", () => {
    expect(() => assertCustomerOwnsOrder(null, 123)).toThrow(OrderAccessDeniedError);
  });

  it("throws for a guest order (customer_id 0) even when a logged-in session is present", () => {
    const session = makeSession(123);
    expect(() => assertCustomerOwnsOrder(session, 0)).toThrow(OrderAccessDeniedError);
  });
});
