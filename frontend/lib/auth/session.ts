import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { serverEnv } from "@/config/env";
import { wcRestFetch } from "@/lib/woocommerce/rest-client";

/**
 * The COFEO session cookie — a self-contained, HMAC-signed token (the
 * same hand-rolled-crypto posture as the OAuth1.0a signing in
 * rest-client.ts, no new dependency pulled in for it), never a
 * database-backed session id. There is no database this Next.js app
 * can write to directly; WooCommerce, reached only through its REST
 * APIs, is the one piece of persistent infrastructure this project
 * already has, so genuine server-side revocation (see
 * `SESSION_GENERATION_META_KEY` below) is layered on through it rather
 * than inventing a second datastore.
 */
const SESSION_COOKIE = "cofeo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const SESSION_GENERATION_META_KEY = "_cofeo_session_generation";

export type SessionRole = "CUSTOMER" | "ADMIN";

export type Session = {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: SessionRole;
  wooCustomerId: number;
  sessionGeneration: number;
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", serverEnv.SESSION_SECRET).update(payloadB64).digest("base64url");
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === "number" &&
    typeof v.email === "string" &&
    typeof v.firstName === "string" &&
    typeof v.lastName === "string" &&
    (v.role === "CUSTOMER" || v.role === "ADMIN") &&
    typeof v.wooCustomerId === "number" &&
    typeof v.sessionGeneration === "number" &&
    typeof v.issuedAt === "number" &&
    typeof v.expiresAt === "number"
  );
}

/** Exported for tests only — real callers use `setSessionCookie`/`getSession`. */
export function encodeSessionToken(session: Session): string {
  const payloadB64 = base64UrlEncode(JSON.stringify(session));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verifies the HMAC signature (constant-time comparison — a forged or
 * tampered token fails here, before its contents are ever trusted) and
 * that the token hasn't passed its embedded expiry. Does NOT check the
 * live session generation — that requires a WooCommerce round trip and
 * is `getSession`'s job, kept separate so this stays a pure, fast,
 * fully unit-testable function.
 */
export function decodeSessionToken(token: string): Session | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expectedSignature = sign(payloadB64);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }
  if (!isSession(parsed)) return null;
  if (Date.now() > parsed.expiresAt) return null;

  return parsed;
}

export async function setSessionCookie(
  fields: Omit<Session, "issuedAt" | "expiresAt">,
): Promise<void> {
  const now = Date.now();
  const session: Session = { ...fields, issuedAt: now, expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000 };
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSessionToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

type WcCustomerMetaShape = { meta_data?: { key: string; value: unknown }[] };

async function fetchLiveSessionGeneration(wooCustomerId: number): Promise<number | null> {
  try {
    const raw = await wcRestFetch<WcCustomerMetaShape>(`/customers/${wooCustomerId}`);
    const value = raw.meta_data?.find((entry) => entry.key === SESSION_GENERATION_META_KEY)?.value;
    if (typeof value === "number") return value;
    if (typeof value === "string" && value !== "") return Number(value);
    return 0;
  } catch {
    return null;
  }
}

/**
 * The one real authentication check in this app: verifies the cookie's
 * signature and expiry, then confirms its embedded `sessionGeneration`
 * still matches WooCommerce's live copy — the mechanism that makes
 * logout (`lib/actions/auth-actions.ts`'s `logoutAction`, which bumps
 * the live value) actually invalidate the session rather than merely
 * clearing the browser's cookie, and a stolen/copied cookie stops
 * working the moment the real owner logs out, not just at its natural
 * 7-day expiry.
 *
 * That live check costs a WooCommerce round trip, so the exported
 * `getSession` wraps this in React's `cache()` — every call within one
 * request/render reuses the same result rather than refetching. This
 * inner function holds the actual logic and is what tests call
 * directly: `cache()`'s memoization is scoped to a request by Next.js's
 * own request-scoped storage, which doesn't exist outside a real
 * request, so calling the cached wrapper from a plain test would just
 * memoize forever across unrelated test cases instead of resetting.
 */
export async function getSessionUncached(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = decodeSessionToken(token);
  if (!session) return null;

  const liveGeneration = await fetchLiveSessionGeneration(session.wooCustomerId);
  if (liveGeneration === null || liveGeneration !== session.sessionGeneration) return null;

  return session;
}

export const getSession = cache(getSessionUncached);
