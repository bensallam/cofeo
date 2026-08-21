import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";

/**
 * WordPress REST API — public content only (pages, menus). Anything
 * WooCommerce-domain (products, cart, orders) goes through
 * lib/woocommerce instead, per the brief's API strategy (section 7).
 */
export async function wpApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(`/wp-json/wp/v2${path}`, serverEnv.WORDPRESS_API_URL);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "Failed to reach the WordPress REST API", {
      cause,
    });
  }

  if (!response.ok) {
    throw new AppError(
      "SERVER_ERROR",
      `WordPress REST API responded with ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}
