import { serverEnv } from "@/config/env";
import type { SessionRole } from "@/lib/auth/session";

/**
 * Talks to the two new endpoints in wordpress/custom-plugin/auth/
 * class-cofeo-auth-rest.php — plain, unauthenticated fetches (these
 * are public-facing register/login actions, not admin-authenticated
 * wc/v3 calls, so this deliberately does not go through
 * lib/woocommerce/rest-client.ts's OAuth1.0a signing). Raw passwords
 * pass through this module only in transit to WordPress, which is the
 * only place they are ever hashed or verified — nothing here stores,
 * logs, or returns one.
 */

const AUTH_API_BASE = `${serverEnv.WORDPRESS_API_URL}/wp-json/cofeo/v1/auth`;

export type RegisterErrorCode = "VALIDATION_ERROR" | "EMAIL_ALREADY_EXISTS" | "RATE_LIMITED" | "SERVER_ERROR";

export type RegisterResult =
  | { ok: true; userId: number; email: string }
  | { ok: false; code: RegisterErrorCode };

export type LoginErrorCode = "INVALID_CREDENTIALS" | "RATE_LIMITED" | "SERVER_ERROR";

export type LoginResult =
  | {
      ok: true;
      userId: number;
      email: string;
      firstName: string;
      lastName: string;
      wooCustomerId: number;
      role: SessionRole;
      sessionGeneration: number;
    }
  | { ok: false; code: LoginErrorCode };

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(`${AUTH_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json()) as T;
  return { status: response.status, data };
}

export async function registerCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  try {
    const { status, data } = await post<{ userId?: number; email?: string; code?: string }>("/register", input);
    if (status === 200 && typeof data.userId === "number" && typeof data.email === "string") {
      return { ok: true, userId: data.userId, email: data.email };
    }
    const code = data.code;
    if (code === "EMAIL_ALREADY_EXISTS" || code === "VALIDATION_ERROR" || code === "RATE_LIMITED") {
      return { ok: false, code };
    }
    return { ok: false, code: "SERVER_ERROR" };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}

export async function verifyCustomerLogin(input: { email: string; password: string }): Promise<LoginResult> {
  try {
    const { status, data } = await post<{
      userId?: number;
      email?: string;
      firstName?: string;
      lastName?: string;
      wooCustomerId?: number;
      role?: string;
      sessionGeneration?: number;
      code?: string;
    }>("/login", input);

    if (
      status === 200 &&
      typeof data.userId === "number" &&
      typeof data.email === "string" &&
      typeof data.wooCustomerId === "number" &&
      (data.role === "CUSTOMER" || data.role === "ADMIN") &&
      typeof data.sessionGeneration === "number"
    ) {
      return {
        ok: true,
        userId: data.userId,
        email: data.email,
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        wooCustomerId: data.wooCustomerId,
        role: data.role,
        sessionGeneration: data.sessionGeneration,
      };
    }
    if (data.code === "RATE_LIMITED") return { ok: false, code: "RATE_LIMITED" };
    return { ok: false, code: "INVALID_CREDENTIALS" };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}
