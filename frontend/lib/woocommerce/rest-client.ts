import { createHmac, randomBytes } from "node:crypto";
import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";

/**
 * WooCommerce REST API — private/admin operations only (brief section 7).
 * Never call this from a Client Component; it holds the consumer
 * secret and is for server-side use only.
 *
 * WooCommerce requires HTTPS for plain Basic Auth / query-string key
 * auth; over HTTP (as in local dev, see docs/development-environment.md)
 * it instead requires OAuth 1.0a one-legged signing, implemented below
 * per the WooCommerce REST API docs. This works over HTTPS too, so
 * there's no separate code path needed per environment.
 */

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function getConfiguredCredentials(): { key: string; secret: string } {
  const { WC_CONSUMER_KEY: key, WC_CONSUMER_SECRET: secret } = serverEnv;
  if (!key || !secret) {
    throw new AppError(
      "SERVER_ERROR",
      "WooCommerce REST API credentials are not configured for this environment",
    );
  }
  return { key, secret };
}

function signRequest(
  method: string,
  url: URL,
  extraParams: Record<string, string>,
): URLSearchParams {
  const { key, secret } = getConfiguredCredentials();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extraParams,
  };

  const baseUrl = `${url.origin}${url.pathname}`;
  const allParams = { ...oauthParams } as Record<string, string>;
  url.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });

  const sortedParamString = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(sortedParamString),
  ].join("&");

  const signingKey = `${percentEncode(secret)}&`;
  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const signedParams = new URLSearchParams(allParams);
  signedParams.set("oauth_signature", signature);
  return signedParams;
}

export async function wcRestFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(`/wp-json/wc/v3${path}`, serverEnv.WORDPRESS_API_URL);
  const method = init?.method ?? "GET";
  const signedParams = signRequest(method, url, {});

  const signedUrl = new URL(url);
  signedUrl.search = signedParams.toString();

  let response: Response;
  try {
    response = await fetch(signedUrl, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "Failed to reach the WooCommerce REST API", {
      cause,
    });
  }

  if (!response.ok) {
    throw new AppError(
      "SERVER_ERROR",
      `WooCommerce REST API responded with ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}
