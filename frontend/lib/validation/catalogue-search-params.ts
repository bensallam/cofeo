import { z } from "zod";

/**
 * URL search params are user-controlled input — validated here rather
 * than trusted directly. Invalid/unrecognized values are dropped
 * (fail closed to "no filter applied") rather than forwarded as-is or
 * throwing, since a malformed filter shouldn't break the whole page.
 */
export const catalogueSearchParamsSchema = z.object({
  category: z.enum(["capsules", "cafe-moulu", "cafe-en-grains"]).optional(),
  condition: z.enum(["new", "excellent", "very-good", "good"]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["price-asc", "price-desc", "newest"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});

export type CatalogueSearchParams = z.infer<typeof catalogueSearchParamsSchema>;

export function parseCatalogueSearchParams(
  raw: Record<string, string | string[] | undefined>,
): CatalogueSearchParams {
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const result = catalogueSearchParamsSchema.safeParse(normalized);
  return result.success ? result.data : {};
}
