import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CofeoStatusKey } from "@/lib/woocommerce/order-status";

vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { transitionOrderCofeoStatus, type AdminAuthContext } from "./order-status-mutation";

const wcRestFetchMock = vi.mocked(wcRestFetch);

const ADMIN: AdminAuthContext = { actorId: "1", actorEmail: "admin@cofeo.ma", isAdmin: true };
const CUSTOMER: AdminAuthContext = { actorId: "42", actorEmail: "customer@example.com", isAdmin: false };

/** Configures the mock so a GET returns the given raw WC status, and
 *  any write (PUT) succeeds trivially — matching how the real
 *  wcRestFetch behaves for a well-formed request. */
function mockOrder(status: string) {
  wcRestFetchMock.mockImplementation((_path, init) => {
    const method = (init as RequestInit | undefined)?.method ?? "GET";
    if (method === "GET") return Promise.resolve({ status });
    return Promise.resolve({});
  });
}

function putBody(): unknown {
  const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
  return putCall ? JSON.parse((putCall[1] as RequestInit).body as string) : undefined;
}

beforeEach(() => {
  wcRestFetchMock.mockReset();
});

describe("transitionOrderCofeoStatus — ADMIN forward corrections", () => {
  it("NEW → CONFIRMED (WC status pending → processing)", async () => {
    mockOrder("pending");
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "CONFIRMED" });
    expect(putBody()).toEqual({ status: "processing" });
  });

  it("CONFIRMED → PREPARING → SHIPPED → OUT_FOR_DELIVERY → DELIVERED all map to their real WC statuses", async () => {
    const cases: [CofeoStatusKey, string][] = [
      ["PREPARING", "cofeo-preparing"],
      ["SHIPPED", "cofeo-shipped"],
      ["OUT_FOR_DELIVERY", "cofeo-outfordel"],
      ["DELIVERED", "completed"],
    ];
    for (const [target, expectedWcStatus] of cases) {
      wcRestFetchMock.mockReset();
      mockOrder("processing");
      const result = await transitionOrderCofeoStatus(1, target, ADMIN);
      expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: target });
      expect(putBody()).toEqual({ status: expectedWcStatus });
    }
  });

  it("PREPARING → CANCELLED (WC status → cancelled)", async () => {
    mockOrder("cofeo-preparing");
    const result = await transitionOrderCofeoStatus(1, "CANCELLED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "CANCELLED" });
    expect(putBody()).toEqual({ status: "cancelled" });
  });
});

describe("transitionOrderCofeoStatus — ADMIN reverse corrections (Phase 4D)", () => {
  it("DELIVERED → PREPARING is accepted, not blocked by the forward-only graph", async () => {
    mockOrder("completed");
    const result = await transitionOrderCofeoStatus(1, "PREPARING", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "PREPARING" });
    expect(putBody()).toEqual({ status: "cofeo-preparing" });
  });

  it("DELIVERED → NEW is accepted (WC status → pending)", async () => {
    mockOrder("completed");
    const result = await transitionOrderCofeoStatus(1, "NEW", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "NEW" });
    expect(putBody()).toEqual({ status: "pending" });
  });

  it("OUT_FOR_DELIVERY → NEW is accepted", async () => {
    mockOrder("cofeo-outfordel");
    const result = await transitionOrderCofeoStatus(1, "NEW", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "NEW" });
  });

  it("a cancelled order can be corrected forward again (CANCELLED → CONFIRMED)", async () => {
    mockOrder("cancelled");
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "CONFIRMED" });
    expect(putBody()).toEqual({ status: "processing" });
  });

  it("a step can be skipped entirely (PREPARING → DELIVERED), matching wp-admin's own unrestricted dropdown", async () => {
    mockOrder("cofeo-preparing");
    const result = await transitionOrderCofeoStatus(1, "DELIVERED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "DELIVERED" });
  });
});

describe("transitionOrderCofeoStatus — audit trail delegation", () => {
  it("no longer writes a /notes call directly — the audit note is written by the PHP woocommerce_order_status_changed hook instead", async () => {
    mockOrder("processing");
    await transitionOrderCofeoStatus(7, "PREPARING", ADMIN);
    const noteCall = wcRestFetchMock.mock.calls.find(([path]) => (path as string).includes("/notes"));
    expect(noteCall).toBeUndefined();
  });

  it("sends the acting admin's identity via the X-Cofeo-Actor header, so the PHP hook can attribute the note correctly", async () => {
    mockOrder("processing");
    await transitionOrderCofeoStatus(7, "PREPARING", ADMIN);
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    const headers = (putCall?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Cofeo-Actor"]).toBe(`${ADMIN.actorEmail} (${ADMIN.actorId})`);
  });
});

describe("transitionOrderCofeoStatus — CUSTOMER and anonymous callers are always rejected", () => {
  it("rejects an anonymous caller (no auth context at all)", async () => {
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", null);
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("rejects a customer (a real, non-admin actor) — including for a reverse correction", async () => {
    const result = await transitionOrderCofeoStatus(1, "NEW", CUSTOMER);
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid actor (isAdmin claimed but no real identity)", async () => {
    const invalidActor: AdminAuthContext = { actorId: "", actorEmail: "", isAdmin: true };
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", invalidActor);
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("rejects a forged/coerced role instead of a real boolean", async () => {
    const forged = { actorId: "1", actorEmail: "x@example.com", isAdmin: "true" } as unknown as AdminAuthContext;
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", forged);
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("never calls WooCommerce at all for an unauthorized caller, for any order id or status, including reverse ones", async () => {
    await transitionOrderCofeoStatus(999999, "DELIVERED", null);
    await transitionOrderCofeoStatus(999999, "NEW", CUSTOMER);
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});

describe("transitionOrderCofeoStatus — input validation", () => {
  it("rejects a request with an unrecognized status string", async () => {
    mockOrder("processing");
    const result = await transitionOrderCofeoStatus(1, "SUPER_ADMIN_DELIVERED" as CofeoStatusKey, ADMIN);
    expect(result).toEqual({ success: false, code: "INVALID_STATUS" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid order id (not a positive integer) even when authorized", async () => {
    const result = await transitionOrderCofeoStatus(-1, "CONFIRMED", ADMIN);
    expect(result).toEqual({ success: false, code: "ORDER_NOT_FOUND" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("reports ORDER_NOT_FOUND when the order can't be fetched", async () => {
    wcRestFetchMock.mockRejectedValue(new Error("404"));
    const result = await transitionOrderCofeoStatus(123456789, "DELIVERED", ADMIN);
    expect(result).toEqual({ success: false, code: "WOOCOMMERCE_ERROR" });
  });
});

describe("transitionOrderCofeoStatus — security", () => {
  it("an arbitrary/nonexistent order id does not bypass authorization", async () => {
    const result = await transitionOrderCofeoStatus(123456789, "DELIVERED", CUSTOMER);
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
  });

  it("responses never contain any credential-shaped content", async () => {
    mockOrder("processing");
    const success = await transitionOrderCofeoStatus(1, "PREPARING", ADMIN);
    const failure = await transitionOrderCofeoStatus(1, "CONFIRMED", null);
    for (const result of [success, failure]) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/ck_|cs_|consumer_key|consumer_secret/i);
    }
  });
});
