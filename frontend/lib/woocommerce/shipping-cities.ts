import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors/app-error";

/**
 * Reads the exact city master list from the custom COFEO plugin's own
 * public REST namespace (cofeo/v1) — deliberately not wc/v3, no
 * credentials. This is the ONLY source for the checkout city list; the
 * frontend never ships its own copy of cities.txt.
 */
export async function getShippingCities(): Promise<string[]> {
  const url = new URL("/wp-json/cofeo/v1/shipping-cities", serverEnv.WORDPRESS_API_URL);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "Failed to reach the shipping-cities endpoint", { cause });
  }

  if (!response.ok) {
    throw new AppError("SERVER_ERROR", `Shipping-cities endpoint responded with ${response.status}`);
  }

  const data = (await response.json()) as { cities: string[] };
  return data.cities;
}
