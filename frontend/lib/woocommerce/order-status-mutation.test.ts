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

/** Configures the mock so a GET returns the given order shape, and any
 *  write (PUT/POST) succeeds trivially — matching how the real
 *  wcRestFetch behaves for a well-formed request. */
function mockOrder(status: string, metaStatus?: string) {
  wcRestFetchMock.mockImplementation((_path, init) => {
    const method = (init as RequestInit | undefined)?.method ?? "GET";
    if (method === "GET") {
      return Promise.resolve({
        status,
        meta_data: metaStatus ? [{ key: "_cofeo_order_status", value: metaStatus }] : [],
      });
    }
    return Promise.resolve({});
  });
}

beforeEach(() => {
  wcRestFetchMock.mockReset();
});

describe("transitionOrderCofeoStatus — authorized, valid transitions", () => {
  it("NEW → CONFIRMED (WC status pending → processing)", async () => {
    mockOrder("pending");
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "CONFIRMED" });
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ status: "processing" });
  });

  it("CONFIRMED → PREPARING (Phase 4A: a real WC status write, cofeo-preparing)", async () => {
    mockOrder("processing");
    const result = await transitionOrderCofeoStatus(1, "PREPARING", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "PREPARING" });
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ status: "cofeo-preparing" });
  });

  it("PREPARING → SHIPPED (real status, no meta lookup needed for the current state)", async () => {
    mockOrder("cofeo-preparing");
    const result = await transitionOrderCofeoStatus(1, "SHIPPED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "SHIPPED" });
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ status: "cofeo-shipped" });
  });

  it("SHIPPED → OUT_FOR_DELIVERY", async () => {
    mockOrder("cofeo-shipped");
    const result = await transitionOrderCofeoStatus(1, "OUT_FOR_DELIVERY", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "OUT_FOR_DELIVERY" });
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ status: "cofeo-outfordel" });
  });

  it("still honors legacy meta for an un-migrated historical order (PREPARING via meta -> SHIPPED)", async () => {
    mockOrder("processing", "PREPARING");
    const result = await transitionOrderCofeoStatus(1, "SHIPPED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "SHIPPED" });
  });

  it("OUT_FOR_DELIVERY → DELIVERED (WC status → completed)", async () => {
    mockOrder("processing", "OUT_FOR_DELIVERY");
    const result = await transitionOrderCofeoStatus(1, "DELIVERED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "DELIVERED" });
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ status: "completed" });
  });

  it("PREPARING → CANCELLED (WC status → cancelled)", async () => {
    mockOrder("processing", "PREPARING");
    const result = await transitionOrderCofeoStatus(1, "CANCELLED", ADMIN);
    expect(result).toEqual({ success: true, orderId: 1, cofeoStatus: "CANCELLED" });
    const putCall = wcRestFetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(JSON.parse((putCall?.[1] as RequestInit).body as string)).toEqual({ status: "cancelled" });
  });

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

describe("transitionOrderCofeoStatus — unauthorized callers", () => {
  it("rejects an anonymous caller (no auth context at all)", async () => {
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", null);
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("rejects a customer (a real, non-admin actor)", async () => {
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", CUSTOMER);
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

  it("never calls WooCommerce at all for an unauthorized caller, for any order id", async () => {
    await transitionOrderCofeoStatus(999999, "DELIVERED", null);
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});

describe("transitionOrderCofeoStatus — invalid transitions", () => {
  it.each([
    ["pending", undefined, "SHIPPED"],
    ["pending", undefined, "DELIVERED"],
    ["completed", undefined, "PREPARING"],
    ["completed", undefined, "CONFIRMED"],
    ["cancelled", undefined, "CONFIRMED"],
  ] as [string, string | undefined, CofeoStatusKey][])(
    "rejects wc=%s meta=%s → %s",
    async (wcStatus, meta, requested) => {
      mockOrder(wcStatus, meta);
      const result = await transitionOrderCofeoStatus(1, requested, ADMIN);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(["INVALID_TRANSITION", "TERMINAL_ORDER"]).toContain(result.code);
      }
    },
  );

  it("rejects a request with an unrecognized status string", async () => {
    mockOrder("processing");
    const result = await transitionOrderCofeoStatus(1, "SUPER_ADMIN_DELIVERED" as CofeoStatusKey, ADMIN);
    expect(result).toEqual({ success: false, code: "INVALID_STATUS" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});

describe("transitionOrderCofeoStatus — WooCommerce terminal status protection", () => {
  it("a completed WC order cannot be overridden by any COFEO status request", async () => {
    mockOrder("completed");
    const result = await transitionOrderCofeoStatus(1, "PREPARING", ADMIN);
    expect(result).toEqual({ success: false, code: "TERMINAL_ORDER" });
  });

  it("a cancelled WC order cannot be overridden even with stale refinement-looking meta", async () => {
    mockOrder("cancelled", "SHIPPED");
    const result = await transitionOrderCofeoStatus(1, "CONFIRMED", ADMIN);
    expect(result).toEqual({ success: false, code: "TERMINAL_ORDER" });
  });

  it("never issues a write when the order is terminal", async () => {
    mockOrder("completed");
    await transitionOrderCofeoStatus(1, "PREPARING", ADMIN);
    expect(wcRestFetchMock).toHaveBeenCalledTimes(1); // only the initial GET
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

  it("rejects an invalid order id (not a positive integer) even when authorized", async () => {
    const result = await transitionOrderCofeoStatus(-1, "CONFIRMED", ADMIN);
    expect(result).toEqual({ success: false, code: "ORDER_NOT_FOUND" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});
