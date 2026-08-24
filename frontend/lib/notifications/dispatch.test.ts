import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

vi.mock("@/lib/notifications/mailer", () => ({
  getMailer: vi.fn(),
}));

import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { getMailer } from "@/lib/notifications/mailer";
import { handleOrderStatusChanged } from "@/lib/notifications/dispatch";

const wcRestFetchMock = vi.mocked(wcRestFetch);
const getMailerMock = vi.mocked(getMailer);

type MockOrderOptions = {
  status?: string;
  email?: string;
  locale?: string;
  lastNotifiedStatus?: string;
  cofeoMetaStatus?: string;
};

function mockOrder(options: MockOrderOptions = {}) {
  const metaData: { key: string; value: string }[] = [];
  if (options.locale) metaData.push({ key: "_cofeo_locale", value: options.locale });
  if (options.lastNotifiedStatus) {
    metaData.push({ key: "_cofeo_last_notified_status", value: options.lastNotifiedStatus });
  }
  if (options.cofeoMetaStatus) {
    metaData.push({ key: "_cofeo_order_status", value: options.cofeoMetaStatus });
  }

  const order = {
    id: 77,
    number: "77",
    status: options.status ?? "processing",
    order_key: "wc_order_secretkey123",
    billing: {
      first_name: "Amina",
      last_name: "Bensouda",
      email: options.email ?? "amina@example.com",
      phone: "+212612345678",
    },
    meta_data: metaData,
  };

  wcRestFetchMock.mockImplementation((path, init) => {
    const method = (init as RequestInit | undefined)?.method ?? "GET";
    if (method === "GET") return Promise.resolve(order);
    return Promise.resolve({});
  });

  return order;
}

const sendMock = vi.fn();

beforeEach(() => {
  wcRestFetchMock.mockReset();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ success: true });
  getMailerMock.mockReset();
  getMailerMock.mockReturnValue({ send: sendMock });
});

describe("handleOrderStatusChanged — happy path", () => {
  it("sends a notification for a notifiable status and records it", async () => {
    mockOrder({ status: "processing", locale: "en" });

    const result = await handleOrderStatusChanged(77);

    expect(result).toEqual({ outcome: "sent", status: "CONFIRMED" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [message] = sendMock.mock.calls[0];
    expect(message.to).toBe("amina@example.com");
    expect(message.subject).toContain("77");

    const putCalls = wcRestFetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(putCalls).toHaveLength(1);
    const putBody = JSON.parse((putCalls[0][1] as RequestInit).body as string);
    expect(putBody).toEqual({ meta_data: [{ key: "_cofeo_last_notified_status", value: "CONFIRMED" }] });

    const noteCalls = wcRestFetchMock.mock.calls.filter(([path]) => (path as string).includes("/notes"));
    expect(noteCalls).toHaveLength(1);
  });

  it("uses the order's captured locale for the email content (Arabic, RTL)", async () => {
    mockOrder({ status: "cofeo-shipped", locale: "ar" });

    await handleOrderStatusChanged(77);

    const [message] = sendMock.mock.calls[0];
    expect(message.html).toContain('dir="rtl"');
    expect(message.html).toContain("Cofeo");
  });

  it("uses French templates by default when no locale was captured", async () => {
    mockOrder({ status: "processing" });

    await handleOrderStatusChanged(77);

    const [message] = sendMock.mock.calls[0];
    expect(message.html).toContain('dir="ltr"');
    expect(message.subject).toContain("Mise à jour");
  });

  it("builds a tracking URL using the order's own order_key, the same ownership mechanism /order-confirmation uses", async () => {
    mockOrder({ status: "completed", locale: "fr" });

    await handleOrderStatusChanged(77);

    const [message] = sendMock.mock.calls[0];
    expect(message.html).toContain("order=77");
    expect(message.html).toContain("key=wc_order_secretkey123");
  });
});

describe("handleOrderStatusChanged — NEW is never notified", () => {
  it("skips a pending (NEW) order without sending anything", async () => {
    mockOrder({ status: "pending" });

    const result = await handleOrderStatusChanged(77);

    expect(result).toEqual({ outcome: "skipped", reason: "not_notifiable" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(wcRestFetchMock).toHaveBeenCalledTimes(1); // only the initial GET
  });
});

describe("handleOrderStatusChanged — duplicate prevention", () => {
  it("does not re-send when the current status already matches the last-notified status", async () => {
    mockOrder({ status: "processing", lastNotifiedStatus: "CONFIRMED" });

    const result = await handleOrderStatusChanged(77);

    expect(result).toEqual({ outcome: "skipped", reason: "duplicate" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(wcRestFetchMock).toHaveBeenCalledTimes(1); // only the initial GET — no note, no meta write
  });

  it("does send when the status has moved on from the last-notified one", async () => {
    mockOrder({ status: "cofeo-preparing", lastNotifiedStatus: "CONFIRMED" });

    const result = await handleOrderStatusChanged(77);

    expect(result).toEqual({ outcome: "sent", status: "PREPARING" });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("handleOrderStatusChanged — missing email", () => {
  it("skips gracefully and logs a note instead of throwing", async () => {
    mockOrder({ status: "processing", email: "" });

    const result = await handleOrderStatusChanged(77);

    expect(result).toEqual({ outcome: "skipped", reason: "no_email" });
    expect(sendMock).not.toHaveBeenCalled();
    const noteCalls = wcRestFetchMock.mock.calls.filter(([path]) => (path as string).includes("/notes"));
    expect(noteCalls).toHaveLength(1);
  });
});

describe("handleOrderStatusChanged — mailer failure isolation", () => {
  it("never throws, records the failure, and does not update the idempotency marker (so a retry can still happen)", async () => {
    mockOrder({ status: "processing" });
    sendMock.mockResolvedValue({ success: false, error: "smtp unreachable" });

    const result = await handleOrderStatusChanged(77);

    expect(result).toEqual({ outcome: "failed", status: "CONFIRMED", error: "smtp unreachable" });
    const putCalls = wcRestFetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(putCalls).toHaveLength(0);
    const noteCalls = wcRestFetchMock.mock.calls.filter(([path]) => (path as string).includes("/notes"));
    expect(noteCalls).toHaveLength(1);
  });

  it("never touches the order's status field, even on failure", async () => {
    mockOrder({ status: "processing" });
    sendMock.mockRejectedValue(new Error("network down"));

    await handleOrderStatusChanged(77);

    for (const [, init] of wcRestFetchMock.mock.calls) {
      const body = (init as RequestInit | undefined)?.body;
      if (typeof body === "string") {
        expect(JSON.parse(body)).not.toHaveProperty("status");
      }
    }
  });
});

describe("handleOrderStatusChanged — order lookup failure", () => {
  it("returns a skipped result instead of throwing when the order can't be fetched", async () => {
    wcRestFetchMock.mockRejectedValue(new Error("not found"));

    const result = await handleOrderStatusChanged(999999);

    expect(result).toEqual({ outcome: "skipped", reason: "order_not_found" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a non-positive order id before ever calling WooCommerce", async () => {
    const result = await handleOrderStatusChanged(-1);

    expect(result).toEqual({ outcome: "skipped", reason: "order_not_found" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});
