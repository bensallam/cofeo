import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { getLoyaltySummaryForCustomer, getLoyaltyTransactionsForOrder } from "./loyalty";

const wcRestFetchMock = vi.mocked(wcRestFetch);

beforeEach(() => {
  wcRestFetchMock.mockReset();
});

describe("getLoyaltySummaryForCustomer", () => {
  it("returns the empty summary for an invalid customer id without calling WooCommerce (never a guest balance)", async () => {
    expect(await getLoyaltySummaryForCustomer(0)).toEqual({ balance: 0, totalEarned: 0, totalReversed: 0, transactions: [] });
    expect(await getLoyaltySummaryForCustomer(-1)).toEqual({ balance: 0, totalEarned: 0, totalReversed: 0, transactions: [] });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("scopes the request to the given customer id, never fetching another customer's record", async () => {
    wcRestFetchMock.mockResolvedValue({ meta_data: [] });
    await getLoyaltySummaryForCustomer(7);
    const [path] = wcRestFetchMock.mock.calls[0];
    expect(path).toBe("/customers/7");
  });

  it("reads balance/totalEarned/totalReversed from customer meta", async () => {
    wcRestFetchMock.mockResolvedValue({
      meta_data: [
        { key: "cofeo_loyalty_balance", value: 100 },
        { key: "cofeo_loyalty_total_earned", value: 150 },
        { key: "cofeo_loyalty_total_reversed", value: 50 },
      ],
    });
    const result = await getLoyaltySummaryForCustomer(7);
    expect(result.balance).toBe(100);
    expect(result.totalEarned).toBe(150);
    expect(result.totalReversed).toBe(50);
  });

  it("defaults balance/totalEarned/totalReversed to 0 when the meta is missing (a customer with no history yet)", async () => {
    wcRestFetchMock.mockResolvedValue({ meta_data: [] });
    const result = await getLoyaltySummaryForCustomer(7);
    expect(result).toEqual({ balance: 0, totalEarned: 0, totalReversed: 0, transactions: [] });
  });

  it("reconstructs transactions from the per-event customer meta entries, newest first", async () => {
    wcRestFetchMock.mockResolvedValue({
      meta_data: [
        {
          key: "cofeo_loyalty_txn_58_1_EARN",
          value: JSON.stringify({ type: "EARN", points: 6490, orderId: 58, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T02:36:28+00:00" }),
        },
        {
          key: "cofeo_loyalty_txn_58_1_REVERSAL",
          value: JSON.stringify({ type: "REVERSAL", points: 6490, orderId: 58, episode: 1, reason: "STATUS_CORRECTED", createdAt: "2026-08-25T02:36:52+00:00" }),
        },
      ],
    });
    const result = await getLoyaltySummaryForCustomer(7);
    expect(result.transactions).toEqual([
      { type: "REVERSAL", points: 6490, orderId: 58, episode: 1, reason: "STATUS_CORRECTED", createdAt: "2026-08-25T02:36:52+00:00" },
      { type: "EARN", points: 6490, orderId: 58, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T02:36:28+00:00" },
    ]);
  });

  it("silently drops a malformed individual transaction record without discarding the rest", async () => {
    wcRestFetchMock.mockResolvedValue({
      meta_data: [
        { key: "cofeo_loyalty_txn_1_1_EARN", value: "{not valid json" },
        { key: "cofeo_loyalty_txn_2_1_EARN", value: JSON.stringify({ type: "SOMETHING_ELSE", points: 10, orderId: 2, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T00:00:00Z" }) },
        { key: "cofeo_loyalty_txn_3_1_EARN", value: JSON.stringify({ type: "EARN", points: -5, orderId: 3, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T00:00:00Z" }) },
        { key: "cofeo_loyalty_txn_4_1_EARN", value: JSON.stringify({ type: "EARN", points: 10, orderId: 4, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T00:00:00Z" }) },
      ],
    });
    const result = await getLoyaltySummaryForCustomer(7);
    expect(result.transactions).toEqual([
      { type: "EARN", points: 10, orderId: 4, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T00:00:00Z" },
    ]);
  });

  it("never includes any PII field (no email, no name, no address) — only the four safe fields plus orderId/episode", async () => {
    wcRestFetchMock.mockResolvedValue({
      meta_data: [
        {
          key: "cofeo_loyalty_txn_1_1_EARN",
          value: JSON.stringify({
            type: "EARN",
            points: 10,
            orderId: 1,
            episode: 1,
            reason: "ORDER_DELIVERED",
            createdAt: "2026-08-25T00:00:00Z",
            email: "leaked@example.com",
            customerName: "Should Not Appear",
          }),
        },
      ],
    });
    const result = await getLoyaltySummaryForCustomer(7);
    expect(Object.keys(result.transactions[0]).sort()).toEqual(
      ["createdAt", "episode", "orderId", "points", "reason", "type"].sort(),
    );
  });

  it("returns the empty summary (not a throw) when WooCommerce can't be reached", async () => {
    wcRestFetchMock.mockRejectedValue(new Error("network error"));
    expect(await getLoyaltySummaryForCustomer(7)).toEqual({ balance: 0, totalEarned: 0, totalReversed: 0, transactions: [] });
  });
});

describe("getLoyaltyTransactionsForOrder", () => {
  it("returns an empty list for an invalid order id without calling WooCommerce", async () => {
    expect(await getLoyaltyTransactionsForOrder(0)).toEqual([]);
    expect(await getLoyaltyTransactionsForOrder(-1)).toEqual([]);
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("reconstructs this order's own transactions, attaching the known orderId (absent from the order-meta JSON itself)", async () => {
    wcRestFetchMock.mockResolvedValue({
      meta_data: [
        {
          key: "_cofeo_loyalty_txn_1_EARN",
          value: JSON.stringify({ type: "EARN", points: 6490, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T02:36:28+00:00" }),
        },
      ],
    });
    const result = await getLoyaltyTransactionsForOrder(58);
    expect(result).toEqual([
      { type: "EARN", points: 6490, orderId: 58, episode: 1, reason: "ORDER_DELIVERED", createdAt: "2026-08-25T02:36:28+00:00" },
    ]);
  });

  it("returns an empty list (not a throw) when WooCommerce can't be reached", async () => {
    wcRestFetchMock.mockRejectedValue(new Error("network error"));
    expect(await getLoyaltyTransactionsForOrder(58)).toEqual([]);
  });

  it("returns an empty list for an order with no loyalty transactions yet", async () => {
    wcRestFetchMock.mockResolvedValue({ meta_data: [] });
    expect(await getLoyaltyTransactionsForOrder(58)).toEqual([]);
  });
});
