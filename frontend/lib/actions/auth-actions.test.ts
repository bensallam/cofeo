import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/wp-auth-client", () => ({
  registerCustomer: vi.fn(),
  verifyCustomerLogin: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  getSession: vi.fn(),
  SESSION_GENERATION_META_KEY: "_cofeo_session_generation",
}));
vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

import { registerCustomer, verifyCustomerLogin } from "@/lib/auth/wp-auth-client";
import { setSessionCookie } from "@/lib/auth/session";
import { registerAction, loginAction } from "./auth-actions";

const registerCustomerMock = vi.mocked(registerCustomer);
const verifyCustomerLoginMock = vi.mocked(verifyCustomerLogin);
const setSessionCookieMock = vi.mocked(setSessionCookie);

beforeEach(() => {
  registerCustomerMock.mockReset();
  verifyCustomerLoginMock.mockReset();
  setSessionCookieMock.mockReset();
});

const VALID_REGISTER_INPUT = {
  firstName: "Test",
  lastName: "Customer",
  email: "test@example.com",
  password: "GoodPass123",
  confirmPassword: "GoodPass123",
};

describe("registerAction", () => {
  it("succeeds for a valid registration", async () => {
    registerCustomerMock.mockResolvedValue({ ok: true, userId: 5, email: "test@example.com" });
    const result = await registerAction(VALID_REGISTER_INPUT);
    expect(result).toEqual({ ok: true });
  });

  it("rejects an invalid email before ever calling WordPress", async () => {
    const result = await registerAction({ ...VALID_REGISTER_INPUT, email: "not-an-email" });
    expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR" });
    expect(registerCustomerMock).not.toHaveBeenCalled();
  });

  it("rejects a weak password before ever calling WordPress", async () => {
    const result = await registerAction({ ...VALID_REGISTER_INPUT, password: "weak", confirmPassword: "weak" });
    expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR" });
    expect(registerCustomerMock).not.toHaveBeenCalled();
  });

  it("rejects a password/confirmPassword mismatch before ever calling WordPress", async () => {
    const result = await registerAction({ ...VALID_REGISTER_INPUT, confirmPassword: "SomethingElse123" });
    expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR" });
    expect(registerCustomerMock).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate-account error from WordPress", async () => {
    registerCustomerMock.mockResolvedValue({ ok: false, code: "EMAIL_ALREADY_EXISTS" });
    const result = await registerAction(VALID_REGISTER_INPUT);
    expect(result).toEqual({ ok: false, code: "EMAIL_ALREADY_EXISTS" });
  });
});

describe("loginAction", () => {
  it("rejects missing credentials before ever calling WordPress", async () => {
    const result = await loginAction({ email: "", password: "", locale: "fr" });
    expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR" });
    expect(verifyCustomerLoginMock).not.toHaveBeenCalled();
  });

  it("surfaces invalid credentials and never sets a session cookie", async () => {
    verifyCustomerLoginMock.mockResolvedValue({ ok: false, code: "INVALID_CREDENTIALS" });
    const result = await loginAction({ email: "test@example.com", password: "wrong", locale: "fr" });
    expect(result).toEqual({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("surfaces rate limiting from WordPress", async () => {
    verifyCustomerLoginMock.mockResolvedValue({ ok: false, code: "RATE_LIMITED" });
    const result = await loginAction({ email: "test@example.com", password: "whatever123", locale: "fr" });
    expect(result).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("creates a session cookie with the WordPress-derived role, never a client-supplied one, on success", async () => {
    verifyCustomerLoginMock.mockResolvedValue({
      ok: true,
      userId: 3,
      email: "customer@example.com",
      firstName: "A",
      lastName: "B",
      wooCustomerId: 3,
      role: "CUSTOMER",
      sessionGeneration: 0,
    });

    // loginAction redirects on success, which throws NEXT_REDIRECT —
    // expected outside a real Next.js request/render context; what
    // this test actually verifies is that the session was set with the
    // exact fields verifyCustomerLogin returned before that happens.
    await expect(
      loginAction({ email: "customer@example.com", password: "GoodPass123", locale: "fr" }),
    ).rejects.toBeTruthy();

    expect(setSessionCookieMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 3, wooCustomerId: 3, role: "CUSTOMER" }),
    );
  });
});
