import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

import { cookies } from "next/headers";
import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { decodeSessionToken, encodeSessionToken, getSessionUncached, type Session } from "./session";

const cookiesMock = vi.mocked(cookies);
const wcRestFetchMock = vi.mocked(wcRestFetch);

const BASE_SESSION: Session = {
  userId: 7,
  email: "customer@example.com",
  firstName: "Test",
  lastName: "Customer",
  role: "CUSTOMER",
  wooCustomerId: 7,
  sessionGeneration: 0,
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
};

describe("encodeSessionToken / decodeSessionToken", () => {
  it("round-trips a valid session", () => {
    const token = encodeSessionToken(BASE_SESSION);
    expect(decodeSessionToken(token)).toEqual(BASE_SESSION);
  });

  it("rejects a token with a tampered payload (signature no longer matches)", () => {
    const token = encodeSessionToken(BASE_SESSION);
    const [payloadB64, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...BASE_SESSION, role: "ADMIN" }),
      "utf8",
    ).toString("base64url");
    const forged = `${tamperedPayload}.${signature}`;
    expect(forged).not.toBe(token);
    expect(decodeSessionToken(forged)).toBeNull();
    void payloadB64;
  });

  it("rejects a token with a forged signature", () => {
    const token = encodeSessionToken(BASE_SESSION);
    const [payloadB64] = token.split(".");
    const forged = `${payloadB64}.not-the-real-signature`;
    expect(decodeSessionToken(forged)).toBeNull();
  });

  it("rejects a malformed token (no signature separator)", () => {
    expect(decodeSessionToken("not-a-real-token")).toBeNull();
  });

  it("rejects a token that has passed its embedded expiry", () => {
    const expired: Session = { ...BASE_SESSION, expiresAt: Date.now() - 1000 };
    const token = encodeSessionToken(expired);
    expect(decodeSessionToken(token)).toBeNull();
  });

  it("rejects a payload that doesn't have the shape of a real session", () => {
    // Simulates a token signed for some other purpose being replayed here.
    const payloadB64 = Buffer.from(JSON.stringify({ hello: "world" }), "utf8").toString("base64url");
    // Can't forge a valid signature without the server secret, so this
    // also exercises the signature check — but shape validation is a
    // second, independent line of defense worth its own test intent.
    expect(decodeSessionToken(`${payloadB64}.anything`)).toBeNull();
  });
});

function mockCookieStore(token: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === "cofeo_session" && token ? { name, value: token } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

beforeEach(() => {
  cookiesMock.mockReset();
  wcRestFetchMock.mockReset();
});

describe("getSessionUncached", () => {
  it("returns null when there is no session cookie at all (anonymous)", async () => {
    mockCookieStore(undefined);
    expect(await getSessionUncached()).toBeNull();
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("returns the session when the token is valid and the live generation matches", async () => {
    const session: Session = { ...BASE_SESSION, sessionGeneration: 2 };
    mockCookieStore(encodeSessionToken(session));
    wcRestFetchMock.mockResolvedValue({ meta_data: [{ key: "_cofeo_session_generation", value: 2 }] });
    expect(await getSessionUncached()).toEqual(session);
  });

  it("returns null when the token has been logged out (live generation has moved on)", async () => {
    const session: Session = { ...BASE_SESSION, sessionGeneration: 0 };
    mockCookieStore(encodeSessionToken(session));
    // logoutAction already bumped it to 1 server-side — this stale
    // cookie must stop working immediately, not just at its 7-day expiry.
    wcRestFetchMock.mockResolvedValue({ meta_data: [{ key: "_cofeo_session_generation", value: 1 }] });
    expect(await getSessionUncached()).toBeNull();
  });

  it("fails closed (treats the session as invalid) if WooCommerce can't be reached", async () => {
    const session: Session = { ...BASE_SESSION };
    mockCookieStore(encodeSessionToken(session));
    wcRestFetchMock.mockRejectedValue(new Error("network error"));
    expect(await getSessionUncached()).toBeNull();
  });

  it("rejects a forged cookie (invalid signature) without ever calling WooCommerce", async () => {
    mockCookieStore("forged.payload");
    expect(await getSessionUncached()).toBeNull();
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("rejects an expired session without calling WooCommerce", async () => {
    const expired: Session = { ...BASE_SESSION, expiresAt: Date.now() - 1000 };
    mockCookieStore(encodeSessionToken(expired));
    expect(await getSessionUncached()).toBeNull();
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});
