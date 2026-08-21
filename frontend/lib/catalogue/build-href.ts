import type { CatalogueSearchParams } from "@/lib/validation/catalogue-search-params";

/**
 * The one place a catalogue filter/sort/page link gets built — shared by
 * the (server) machines page and the (client) SortSelect, so the two
 * can't drift into building URLs differently. Pure string logic (just
 * URLSearchParams), so it's safe to import from a "use client" file —
 * unlike a Server Component's own function, which can't cross that
 * boundary as a prop.
 *
 * Changing any filter/sort resets `page` back to the start — a changed
 * result set makes the old page number meaningless.
 */
export function buildCatalogueHref(
  current: CatalogueSearchParams,
  changes: Partial<CatalogueSearchParams>,
): string {
  const merged = { ...current, ...changes, page: changes.page };
  const params = new URLSearchParams();
  if (merged.category) params.set("category", merged.category);
  if (merged.condition) params.set("condition", merged.condition);
  if (merged.q) params.set("q", merged.q);
  if (merged.sort) params.set("sort", merged.sort);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const qs = params.toString();
  return qs ? `/machines?${qs}` : "/machines";
}
