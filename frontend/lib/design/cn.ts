type ClassValue = string | false | null | undefined;

/**
 * Minimal className join — no dedup/conflict-resolution (that's what
 * tailwind-merge would add). Not needed yet: components expose typed
 * variant props rather than accepting freeform className overrides
 * everywhere, so class conflicts aren't a live problem. Revisit if that
 * changes.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
