import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Divider } from "@/components/ui/divider";
import { ProductCard } from "@/components/ui/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterSidebar } from "@/components/catalogue/filter-sidebar";
import { FilterDrawer } from "@/components/catalogue/filter-drawer";
import { SortSelect } from "@/components/catalogue/sort-select";
import { Pagination } from "@/components/catalogue/pagination";
import { getProducts, getCategories, PER_PAGE } from "@/lib/woocommerce/products";
import {
  parseCatalogueSearchParams,
} from "@/lib/validation/catalogue-search-params";
import { AppError } from "@/lib/errors/app-error";
import { buildCatalogueHref } from "@/lib/catalogue/build-href";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalogue" });

  return {
    title: `${t("heading")} — COFEO`,
    alternates: {
      canonical: `/${locale}/machines`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/machines`])),
    },
    robots: { index: false }, // demo data only — not for search engines yet
  };
}

export default async function MachinesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const rawSearchParams = await searchParams;
  const filters = parseCatalogueSearchParams(rawSearchParams);

  const t = await getTranslations("Catalogue");
  const findYourMachine = await getTranslations("FindYourMachine");
  const productT = await getTranslations("Product");

  const categoryLabels: Record<string, string> = {
    capsules: findYourMachine("capsules"),
    "cafe-moulu": findYourMachine("ground"),
    "cafe-en-grains": findYourMachine("beans"),
  };

  let result: Awaited<ReturnType<typeof getProducts>> | null = null;
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let loadError: AppError | null = null;

  try {
    [result, categories] = await Promise.all([
      getProducts({
        category: filters.category,
        condition: filters.condition,
        search: filters.q,
        sort: filters.sort,
        page: filters.page,
      }),
      getCategories(),
    ]);
  } catch (error) {
    loadError = error instanceof AppError ? error : new AppError("SERVER_ERROR", "Unknown error");
  }

  const currentPage = filters.page ?? 1;
  const resultsRangeText =
    !loadError && result
      ? t("resultsRange", {
          total: result.total,
          from: result.total === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1,
          to: result.total === 0 ? 0 : (currentPage - 1) * PER_PAGE + result.products.length,
        })
      : "";

  return (
    <Section tone="dark">
      <Container>
        <Breadcrumb items={[{ label: t("heading") }]} label={productT("breadcrumbLabel")} />

        <Heading level={1} size="xl" className="mt-4">
          {t("heading")}
        </Heading>
        <p className="mt-2 max-w-2xl text-body text-text-secondary">{t("description")}</p>

        <Divider className="mt-8 mb-10" />

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="rounded-(--radius-card) border border-border bg-surface/40 p-5 backdrop-blur-xl backdrop-saturate-150">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-caption font-medium tracking-wide text-text-primary uppercase">
                  {t("filtersHeading")}
                </p>
                <Link
                  href={buildCatalogueHref(filters, { category: undefined, condition: undefined, q: undefined })}
                  className="text-body-s text-text-muted underline decoration-dotted transition-colors duration-200 hover:text-gold"
                >
                  {t("clearAllLabel")}
                </Link>
              </div>
              <FilterSidebar filters={filters} categories={categories} categoryLabels={categoryLabels} />
            </div>
          </aside>

          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <FilterDrawer
                  triggerLabel={t("filtersHeading")}
                  title={t("filtersHeading")}
                  closeLabel={t("closeFiltersLabel")}
                >
                  <FilterSidebar filters={filters} categories={categories} categoryLabels={categoryLabels} />
                </FilterDrawer>
              </div>

              <p className="hidden text-body-s text-text-muted lg:block">{resultsRangeText}</p>

              <SortSelect
                filters={filters}
                label={t("sortLabel")}
                defaultOptionLabel={t("sort.newest")}
                optionLabels={{
                  "price-asc": t("sort.priceAsc"),
                  "price-desc": t("sort.priceDesc"),
                  newest: t("sort.newest"),
                }}
              />
            </div>

            <p className="mb-6 text-body-s text-text-muted lg:hidden">{resultsRangeText}</p>

            {loadError && <ErrorState title={t("errorTitle")} description={t("errorDescription")} />}

            {!loadError && result && result.products.length === 0 && (
              <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
            )}

            {!loadError && result && result.products.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3">
                  {result.products.map((product) => (
                    <Link key={product.id} href={`/machines/${product.slug}`}>
                      <ProductCard
                        imageSrc={product.imageSrc}
                        imageAlt={product.imageAlt}
                        brand={product.brand}
                        name={product.name}
                        condition={product.condition}
                        price={product.price}
                        originalPrice={product.originalPrice}
                        available={product.available}
                        warranty
                      />
                    </Link>
                  ))}
                </div>

                <Pagination filters={filters} currentPage={currentPage} totalPages={result.totalPages} />
              </>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
