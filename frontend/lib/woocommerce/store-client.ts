import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";

/**
 * WooCommerce Store API — public, customer-facing (products, cart,
 * checkout). No credentials required; this is the preferred boundary
 * for anything the browser ultimately triggers (brief section 7).
 */
export async function storeApiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(`/wp-json/wc/store/v1${path}`, serverEnv.WORDPRESS_API_URL);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "Failed to reach the Store API", { cause });
  }

  if (!response.ok) {
    throw new AppError(
      "SERVER_ERROR",
      `Store API responded with ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Like storeApiFetch, but also returns the Response so callers can
 * read pagination headers (X-WP-Total / X-WP-TotalPages) — the Store
 * API puts those in headers, not the JSON body.
 */
export async function storeApiFetchWithHeaders<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; headers: Headers }> {
  const url = new URL(`/wp-json/wc/store/v1${path}`, serverEnv.WORDPRESS_API_URL);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "Failed to reach the Store API", { cause });
  }

  if (!response.ok) {
    throw new AppError(
      "SERVER_ERROR",
      `Store API responded with ${response.status}`,
    );
  }

  return { data: (await response.json()) as T, headers: response.headers };
}
