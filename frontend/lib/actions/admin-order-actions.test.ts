import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { getSession } from "@/lib/auth/session";
import { updateOrderStatusAction } from "./admin-order-actions";
import type { Session } from "@/lib/auth/session";

const wcRestFetchMock = vi.mocked(wcRestFetch);
const getSessionMock = vi.mocked(getSession);

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    userId: 1,
    email: "someone@example.com",
    firstName: "Test",
    lastName: "User",
    role: "CUSTOMER",
    wooCustomerId: 1,
    sessionGeneration: 0,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

beforeEach(() => {
  wcRestFetchMock.mockReset();
  getSessionMock.mockReset();
});

/**
 * This is the only entry point a browser can actually reach. Phase 3A
 * connected `getAdminAuthContext` to the real session system — these
 * tests prove the connection is still fail-closed for everyone except
 * a genuine ADMIN-role session, at the actual reachable boundary, not
 * just in the pure transitionOrderCofeoStatus function (see
 * lib/woocommerce/order-status-mutation.test.ts for that layer).
 */
describe("updateOrderStatusAction — role-based authorization", () => {
  it("refuses an anonymous caller (no session at all)", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await updateOrderStatusAction(1, "CONFIRMED");
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("refuses a real, authenticated CUSTOMER session", async () => {
    getSessionMock.mockResolvedValue(makeSession({ role: "CUSTOMER" }));
    const result = await updateOrderStatusAction(1, "CONFIRMED");
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("reaches a valid AdminAuthContext for an ADMIN session and proceeds", async () => {
    getSessionMock.mockResolvedValue(
      makeSession({ role: "ADMIN", userId: 9, email: "admin@cofeo.ma", wooCustomerId: 9 }),
    );
    wcRestFetchMock.mockImplementation((_path, init) => {
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (method === "GET") {
        return Promise.resolve({ status: "processing", meta_data: [] });
      }
      return Promise.resolve({});
    });

    const result = await updateOrderStatusAction(42, "PREPARING");
    expect(result).toEqual({ success: true, orderId: 42, cofeoStatus: "PREPARING" });
    // Proves the auth context actually reached WooCommerce this time,
    // unlike the anonymous/customer cases above.
    expect(wcRestFetchMock).toHaveBeenCalled();
  });

  it("refuses regardless of which order id or status is requested", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await updateOrderStatusAction(999999, "DELIVERED");
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});
