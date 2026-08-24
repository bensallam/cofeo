import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { getOrderById, getOrdersByCustomerId } from "./order";

const wcRestFetchMock = vi.mocked(wcRestFetch);

const RAW_ORDER = {
  id: 42,
  number: "42",
  order_key: "wc_order_abc",
  status: "processing",
  customer_id: 7,
  currency: "MAD",
  date_created: "2026-08-24T10:00:00",
  total: "919.00",
  shipping_total: "29.00",
  discount_total: "0.00",
  payment_method: "cod",
  payment_method_title: "Cash on delivery",
  billing: { first_name: "Amina", last_name: "B", phone: "+212612345678", email: "amina@example.com" },
  shipping: { first_name: "Amina", last_name: "B", address_1: "12 Rue Test", city: "Casablanca" },
  line_items: [{ name: "[TEST] ENA 8", quantity: 1, total: "890.00", image: null }],
  meta_data: [],
};

beforeEach(() => {
  wcRestFetchMock.mockReset();
});

describe("getOrderById", () => {
  it("returns the mapped order for a valid id", async () => {
    wcRestFetchMock.mockResolvedValue(RAW_ORDER);
    const result = await getOrderById(42);
    expect(result).not.toBeNull();
    expect(result?.orderId).toBe(42);
    expect(result?.customerId).toBe(7);
  });

  it("returns null for an invalid id without calling WooCommerce", async () => {
    expect(await getOrderById(-1)).toBeNull();
    expect(await getOrderById(0)).toBeNull();
    expect(await getOrderById(1.5)).toBeNull();
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("returns null when WooCommerce can't be reached", async () => {
    wcRestFetchMock.mockRejectedValue(new Error("network error"));
    expect(await getOrderById(42)).toBeNull();
  });

  it("does not require or check an order_key (ownership is the caller's job)", async () => {
    wcRestFetchMock.mockResolvedValue(RAW_ORDER);
    const result = await getOrderById(42);
    expect(result).not.toBeNull();
  });

  it("Phase 4C: returns an empty statusHistory when the order has no recorded events", async () => {
    wcRestFetchMock.mockResolvedValue(RAW_ORDER);
    const result = await getOrderById(42);
    expect(result?.statusHistory).toEqual([]);
  });

  it("Phase 4C: reconstructs statusHistory from the new per-event meta entries, in the same fetch (no extra request)", async () => {
    wcRestFetchMock.mockResolvedValue({
      ...RAW_ORDER,
      meta_data: [
        {
          key: "_cofeo_status_event_00001735032026123456_aaaaaaaa",
          value: JSON.stringify({ status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:26Z", source: "admin" }),
        },
        {
          key: "_cofeo_status_event_00001735032031654321_bbbbbbbb",
          value: JSON.stringify({ status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:31Z", source: "admin" }),
        },
      ],
    });
    const result = await getOrderById(42);
    expect(result?.statusHistory).toEqual([
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:26Z", source: "admin" },
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:31Z", source: "admin" },
    ]);
    expect(wcRestFetchMock).toHaveBeenCalledTimes(1);
  });

  it("Phase 4C: reconstruction is correct regardless of the order the meta entries arrive in — the genuinely adversarial case", async () => {
    // This is exactly what two independently, concurrently written
    // events look like once read back: the WooCommerce REST API has
    // no obligation to return meta_data in write order, and under a
    // real race the two rows can be persisted in either order. A
    // correct implementation must reconstruct the same, correctly
    // ordered result no matter which of these arrival orders occurs —
    // proving reconstruction depends only on each event's own sort
    // key, never on array position.
    const eventA = {
      key: "_cofeo_status_event_00001735032026500000_11111111",
      value: JSON.stringify({ status: "SHIPPED", previousStatus: "PREPARING", timestamp: "2026-08-24T10:05:00Z", source: "admin" }),
    };
    const eventB = {
      key: "_cofeo_status_event_00001735032026500001_22222222",
      value: JSON.stringify({ status: "OUT_FOR_DELIVERY", previousStatus: "SHIPPED", timestamp: "2026-08-24T10:05:00Z", source: "admin" }),
    };

    wcRestFetchMock.mockResolvedValue({ ...RAW_ORDER, meta_data: [eventA, eventB] });
    const forward = await getOrderById(42);

    wcRestFetchMock.mockResolvedValue({ ...RAW_ORDER, meta_data: [eventB, eventA] });
    const reversed = await getOrderById(42);

    const expected = [
      { status: "SHIPPED", previousStatus: "PREPARING", timestamp: "2026-08-24T10:05:00Z", source: "admin" },
      { status: "OUT_FOR_DELIVERY", previousStatus: "SHIPPED", timestamp: "2026-08-24T10:05:00Z", source: "admin" },
    ];
    expect(forward?.statusHistory).toEqual(expected);
    // Both events survive AND land in the same, correct order, even
    // though the underlying array arrived in the opposite sequence —
    // this is what "one concurrent event can never overwrite/displace
    // another" means from the reader's side.
    expect(reversed?.statusHistory).toEqual(expected);
  });

  it("Phase 4C: silently drops an individual malformed per-event record without discarding the rest", async () => {
    wcRestFetchMock.mockResolvedValue({
      ...RAW_ORDER,
      meta_data: [
        { key: "_cofeo_status_event_00001735032026000000_aaaaaaaa", value: "{not valid json" },
        {
          key: "_cofeo_status_event_00001735032027000000_bbbbbbbb",
          value: JSON.stringify({ status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:27Z", source: "system" }),
        },
      ],
    });
    const result = await getOrderById(42);
    expect(result?.statusHistory).toEqual([
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:27Z", source: "system" },
    ]);
  });

  it("Phase 4C (backward compatibility): still reads the legacy _cofeo_status_history array for orders that predate the hardened storage", async () => {
    const history = [
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
    ];
    wcRestFetchMock.mockResolvedValue({
      ...RAW_ORDER,
      meta_data: [{ key: "_cofeo_status_history", value: JSON.stringify(history) }],
    });
    const result = await getOrderById(42);
    expect(result?.statusHistory).toEqual(history);
    expect(wcRestFetchMock).toHaveBeenCalledTimes(1);
  });

  it("Phase 4C (backward compatibility): merges legacy array events with new per-event records rather than one replacing the other", async () => {
    const legacy = [
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T09:00:00Z", source: "admin" },
    ];
    wcRestFetchMock.mockResolvedValue({
      ...RAW_ORDER,
      meta_data: [
        { key: "_cofeo_status_history", value: JSON.stringify(legacy) },
        {
          key: "_cofeo_status_event_00001735032100000000_cccccccc",
          value: JSON.stringify({ status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:00Z", source: "admin" }),
        },
      ],
    });
    const result = await getOrderById(42);
    expect(result?.statusHistory).toEqual([
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T09:00:00Z", source: "admin" },
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
    ]);
  });

  it("Phase 4C: degrades to an empty statusHistory for malformed legacy meta rather than throwing", async () => {
    wcRestFetchMock.mockResolvedValue({
      ...RAW_ORDER,
      meta_data: [{ key: "_cofeo_status_history", value: "{not valid json" }],
    });
    const result = await getOrderById(42);
    expect(result?.statusHistory).toEqual([]);
  });
});

describe("getOrdersByCustomerId", () => {
  it("scopes the request to the given customer id server-side, never fetching all orders", async () => {
    wcRestFetchMock.mockResolvedValue([RAW_ORDER]);
    await getOrdersByCustomerId(7);
    const [path] = wcRestFetchMock.mock.calls[0];
    expect(path).toContain("/orders?");
    expect(path).toContain("customer=7");
  });

  it("maps every order in the response", async () => {
    wcRestFetchMock.mockResolvedValue([RAW_ORDER, { ...RAW_ORDER, id: 43, number: "43" }]);
    const result = await getOrdersByCustomerId(7);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.orderId)).toEqual([42, 43]);
  });

  it("returns an empty list for an invalid customer id without calling WooCommerce", async () => {
    expect(await getOrdersByCustomerId(0)).toEqual([]);
    expect(await getOrdersByCustomerId(-1)).toEqual([]);
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty list (not a throw) when WooCommerce can't be reached", async () => {
    wcRestFetchMock.mockRejectedValue(new Error("network error"));
    expect(await getOrdersByCustomerId(7)).toEqual([]);
  });
});
