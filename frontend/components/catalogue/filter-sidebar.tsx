import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/design/cn";
import { buildCatalogueHref } from "@/lib/catalogue/build-href";
import type { CatalogueSearchParams } from "@/lib/validation/catalogue-search-params";
import type { CatalogueCategory, ProductCondition } from "@/lib/woocommerce/products";

const CONDITIONS: ProductCondition[] = ["new", "excellent", "very-good", "good"];

type FilterSidebarProps = {
  filters: CatalogueSearchParams;
  categories: CatalogueCategory[];
  categoryLabels: Record<string, string>;
};

/**
 * The actual filter content — rendered once, used in two places: inside
 * the always-visible desktop `<aside>` and inside the mobile
 * FilterDrawer's body. Same real category/condition data and the same
 * `buildCatalogueHref` links either way; only the surrounding chrome
 * differs. No new filter capability — category and condition are the
 * only two the backend (getProducts) supports, matching what the
 * pill-row version already exposed.
 *
 * A real `<select>`-driven checkbox widget isn't used here on purpose:
 * category/condition are single-select (picking one clears/replaces the
 * other), not "any combination" — a checkbox visually promises
 * multi-select, which this data model doesn't offer. The small square
 * indicator gives the reference's "checkbox row" look without claiming
 * behavior that isn't real.
 */
export async function FilterSidebar({ filters, categories, categoryLabels }: FilterSidebarProps) {
  const t = await getTranslations("Catalogue");
  const productT = await getTranslations("Product");

  return (
    <div className="flex flex-col gap-6">
      {/* Plain GET form, no client JS required — same as before. */}
      <form method="get" action="/machines" className="flex flex-col gap-1.5">
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        {filters.condition && <input type="hidden" name="condition" value={filters.condition} />}
        {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
        <Input
          label={t("searchLabel")}
          name="q"
          type="search"
          placeholder={t("searchPlaceholder")}
          defaultValue={filters.q ?? ""}
        />
      </form>

      <FilterSection label={t("categoryLabel")}>
        <FilterOption href={buildCatalogueHref(filters, { category: undefined })} active={!filters.category}>
          {t("allCategories")}
        </FilterOption>
        {categories.map((category) => (
          <FilterOption
            key={category.id}
            href={buildCatalogueHref(filters, {
              category:
                filters.category === category.slug
                  ? undefined
                  : (category.slug as CatalogueSearchParams["category"]),
            })}
            active={filters.category === category.slug}
            count={category.count}
          >
            {categoryLabels[category.slug] ?? category.name}
          </FilterOption>
        ))}
      </FilterSection>

      <FilterSection label={t("conditionLabel")} last>
        <FilterOption href={buildCatalogueHref(filters, { condition: undefined })} active={!filters.condition}>
          {t("allConditions")}
        </FilterOption>
        {CONDITIONS.map((condition) => (
          <FilterOption
            key={condition}
            href={buildCatalogueHref(filters, {
              condition: filters.condition === condition ? undefined : condition,
            })}
            active={filters.condition === condition}
          >
            {productT(`condition.${condition}`)}
          </FilterOption>
        ))}
      </FilterSection>
    </div>
  );
}

function FilterSection({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3", !last && "border-b border-border pb-6")}>
      <p className="text-caption font-medium tracking-wide text-text-muted uppercase">{label}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function FilterOption({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  /** Real WooCommerce category counts (getCategories()) only — condition
   * has no equivalent backend aggregation, so it's never passed one
   * rather than showing a fabricated number. */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 text-body-s">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-200",
          active ? "border-text-primary bg-text-primary" : "border-border-strong group-hover:border-text-primary",
        )}
      />
      <span
        className={cn(
          "transition-colors duration-200",
          active ? "font-medium text-text-primary" : "text-text-secondary group-hover:text-text-primary",
        )}
      >
        {children}
      </span>
      {count !== undefined && <span className="ms-auto text-caption text-text-muted">{count}</span>}
    </Link>
  );
}
