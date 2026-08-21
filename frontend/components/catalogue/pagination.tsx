import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/design/cn";
import { buildCatalogueHref } from "@/lib/catalogue/build-href";
import type { CatalogueSearchParams } from "@/lib/validation/catalogue-search-params";

type PaginationProps = {
  filters: CatalogueSearchParams;
  currentPage: number;
  totalPages: number;
};

const PAGE_ITEM =
  "flex min-w-9 items-center justify-center rounded-(--radius-control) px-2 py-1.5 text-body-s transition-colors duration-200";

/**
 * Numbered pages built from the `total`/`totalPages` getProducts()
 * already returns — no new backend query, just a different rendering
 * of the same data the old Previous/Next pair used. Windowed (current
 * ± 1, always first/last, "…" for gaps) rather than listing every page
 * — a generic, standard pagination shape, not tuned to any specific
 * product count.
 */
export async function Pagination({ filters, currentPage, totalPages }: PaginationProps) {
  const t = await getTranslations("Catalogue");

  if (totalPages <= 1) return null;

  const pages = buildPageList(currentPage, totalPages);

  return (
    <nav aria-label={t("paginationLabel")} className="mt-12 flex items-center justify-center gap-1.5">
      <PageLink
        href={buildCatalogueHref(filters, { page: Math.max(1, currentPage - 1) })}
        disabled={currentPage <= 1}
        aria-label={t("previous")}
      >
        <ChevronIcon direction="prev" />
      </PageLink>

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-body-s text-text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <PageLink
            key={page}
            href={buildCatalogueHref(filters, { page })}
            active={page === currentPage}
            aria-label={t("pageLabel", { number: page })}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </PageLink>
        ),
      )}

      <PageLink
        href={buildCatalogueHref(filters, { page: Math.min(totalPages, currentPage + 1) })}
        disabled={currentPage >= totalPages}
        aria-label={t("next")}
      >
        <ChevronIcon direction="next" />
      </PageLink>
    </nav>
  );
}

function buildPageList(current: number, total: number): (number | "ellipsis")[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...rest
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<typeof Link>) {
  if (disabled) {
    return (
      <span className={cn(PAGE_ITEM, "pointer-events-none text-text-muted opacity-40")} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        PAGE_ITEM,
        active ? "bg-text-primary text-text-inverse" : "text-text-secondary hover:bg-surface-hover",
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

function ChevronIcon({ direction }: { direction: "prev" | "next" }) {
  const d = direction === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 rtl:-scale-x-100" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
