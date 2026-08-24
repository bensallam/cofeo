import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/config/env", () => ({
  serverEnv: { COFEO_NOTIFICATION_WEBHOOK_SECRET: "correct-secret" },
  publicEnv: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
}));

vi.mock("@/lib/notifications/dispatch", () => ({
  handleOrderStatusChanged: vi.fn(),
}));

import { handleOrderStatusChanged } from "@/lib/notifications/dispatch";
import { POST } from "./route";

const handleMock = vi.mocked(handleOrderStatusChanged);

function makeRequest(options: { secret?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.secret !== null) headers["x-cofeo-webhook-secret"] = options.secret ?? "correct-secret";

  return new NextRequest("http://localhost:3000/api/webhooks/order-status-changed", {
    method: "POST",
    headers,
    body: JSON.stringify(options.body ?? { orderId: 51 }),
  });
}

beforeEach(() => {
  handleMock.mockReset();
  handleMock.mockResolvedValue({ outcome: "sent", status: "CONFIRMED" });
});

describe("POST /api/webhooks/order-status-changed — authentication", () => {
  it("rejects a request with no secret header", async () => {
    const response = await POST(makeRequest({ secret: null }));
    expect(response.status).toBe(401);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await POST(makeRequest({ secret: "wrong-secret" }));
    expect(response.status).toBe(401);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("rejects a secret of a different length without throwing", async () => {
    const response = await POST(makeRequest({ secret: "short" }));
    expect(response.status).toBe(401);
  });

  it("accepts a request with the correct secret", async () => {
    const response = await POST(makeRequest({ secret: "correct-secret" }));
    expect(response.status).toBe(200);
    expect(handleMock).toHaveBeenCalledWith(51);
  });
});

describe("POST /api/webhooks/order-status-changed — input validation", () => {
  it("rejects a missing orderId", async () => {
    const response = await POST(makeRequest({ body: {} }));
    expect(response.status).toBe(400);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric orderId", async () => {
    const response = await POST(makeRequest({ body: { orderId: "51; DROP TABLE orders" } }));
    expect(response.status).toBe(400);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("rejects a negative orderId", async () => {
    const response = await POST(makeRequest({ body: { orderId: -5 } }));
    expect(response.status).toBe(400);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("never trusts a status value even if the caller supplies one", async () => {
    const response = await POST(makeRequest({ body: { orderId: 51, status: "DELIVERED" } }));
    expect(response.status).toBe(200);
    // Only the id is ever passed through — dispatch.ts re-derives status itself.
    expect(handleMock).toHaveBeenCalledWith(51);
    expect(handleMock).not.toHaveBeenCalledWith(51, "DELIVERED");
  });
});
