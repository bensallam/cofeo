"use server";

import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { registerInputSchema, loginInputSchema } from "@/lib/validation/auth";
import { registerCustomer, verifyCustomerLogin } from "@/lib/auth/wp-auth-client";
import { setSessionCookie, clearSessionCookie, getSession, SESSION_GENERATION_META_KEY } from "@/lib/auth/session";
import { wcRestFetch } from "@/lib/woocommerce/rest-client";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

export type RegisterActionResult = { ok: true } | { ok: false; code: AuthErrorCode };
/** Success has no payload: it redirects server-side to /account,
 * exactly the pattern placeOrderAction uses (see that file's docblock
 * for why a client-side router.push after the fact isn't used here). */
export type LoginActionResult = { ok: false; code: AuthErrorCode };

/**
 * Deliberately reveals `EMAIL_ALREADY_EXISTS` as its own code — this is
 * the one place this app intentionally accepts a small amount of
 * account-enumeration risk, because suppressing it would make
 * registration itself confusing (the user gets no explanation for why
 * their "successful" signup doesn't work) for a case that's already
 * industry-standard to disclose (GitHub, Google, etc. all do). Login,
 * below, is the security-sensitive direction — it never distinguishes
 * "no such account" from "wrong password", from either this action or
 * the WordPress endpoint it calls.
 */
export async function registerAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<RegisterActionResult> {
  const parsed = registerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const result = await registerCustomer({
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (!result.ok) return { ok: false, code: result.code };
  return { ok: true };
}

export async function loginAction(input: {
  email: string;
  password: string;
  locale: Locale;
}): Promise<LoginActionResult> {
  const parsed = loginInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR" };

  const result = await verifyCustomerLogin({ email: parsed.data.email, password: parsed.data.password });
  if (!result.ok) return { ok: false, code: result.code };

  await setSessionCookie({
    userId: result.userId,
    email: result.email,
    firstName: result.firstName,
    lastName: result.lastName,
    role: result.role,
    wooCustomerId: result.wooCustomerId,
    sessionGeneration: result.sessionGeneration,
  });

  return redirect(`/${input.locale}/account`);
}

/**
 * Real invalidation, not just clearing the browser's cookie: bumps the
 * WooCommerce customer's `_cofeo_session_generation` meta (the same
 * field `getSession` checks live on every call — see its docblock), so
 * this specific session — and any other copy of the same signed cookie
 * sitting anywhere else — is rejected from this moment on, not just
 * until it naturally expires. If that write fails, the cookie is still
 * cleared below either way, so this browser is logged out regardless;
 * only *other* copies of the token would remain valid until expiry in
 * that failure case.
 */
export async function logoutAction(locale: Locale): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await wcRestFetch(`/customers/${session.wooCustomerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta_data: [{ key: SESSION_GENERATION_META_KEY, value: session.sessionGeneration + 1 }],
        }),
      });
    } catch {
      // Best-effort revocation — see docblock above.
    }
  }
  await clearSessionCookie();
  return redirect(`/${locale}`);
}
