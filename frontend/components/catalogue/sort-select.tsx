"use client";

import { useRouter } from "@/i18n/navigation";
import { Select } from "@/components/ui/select";
import { buildCatalogueHref } from "@/lib/catalogue/build-href";
import type { CatalogueSearchParams } from "@/lib/validation/catalogue-search-params";

const SORT_VALUES = ["price-asc", "price-desc", "newest"] as const;

type SortSelectProps = {
  filters: CatalogueSearchParams;
  label: string;
  defaultOptionLabel: string;
  optionLabels: Record<(typeof SORT_VALUES)[number], string>;
};

/**
 * The only piece of the catalogue page that needs client JS: a real
 * `<select>` that navigates on change requires a function event
 * handler, which can't cross the Server → Client boundary as a prop —
 * so `buildCatalogueHref` (pure string logic, no server-only APIs) is
 * imported directly here rather than passed in from the server page.
 * Everything else on this page stays a plain Server Component. Reuses
 * the existing design-system `Select` (same styling as every other form
 * control in the app) rather than a hand-rolled `<select>`.
 */
export function SortSelect({ filters, label, defaultOptionLabel, optionLabels }: SortSelectProps) {
  const router = useRouter();

  return (
    <Select
      label={label}
      value={filters.sort ?? ""}
      onChange={(event) => {
        const value = event.target.value;
        router.push(
          buildCatalogueHref(filters, {
            sort: value ? (value as CatalogueSearchParams["sort"]) : undefined,
          }),
        );
      }}
      className="w-auto py-2"
    >
      <option value="">{defaultOptionLabel}</option>
      {SORT_VALUES.map((value) => (
        <option key={value} value={value}>
          {optionLabels[value]}
        </option>
      ))}
    </Select>
  );
}
