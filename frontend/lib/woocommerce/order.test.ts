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
