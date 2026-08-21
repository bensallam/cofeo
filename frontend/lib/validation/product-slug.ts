import { z } from "zod";

/**
 * Route params are untrusted input, same discipline as the Catalogue's
 * search params. A WordPress product slug is always lowercase
 * alphanumeric with single hyphens — anything else is rejected before
 * it ever reaches a Store API query.
 */
export const productSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function isValidProductSlug(value: string): boolean {
  return productSlugSchema.safeParse(value).success;
}
