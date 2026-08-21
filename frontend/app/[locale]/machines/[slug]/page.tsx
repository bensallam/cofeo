import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Price } from "@/components/ui/price";
import { Divider } from "@/components/ui/divider";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ProductGallery } from "@/components/product/product-gallery";
import { AddToCartBox } from "@/components/product/add-to-cart-box";
import { RelatedProducts } from "@/components/product/related-products";
import { ProcessStep } from "@/components/homepage/process-step";
import { getProductBySlug, getProducts, type ProductDetail } from "@/lib/woocommerce/products";
import { isValidProductSlug } from "@/lib/validation/product-slug";
import { AppError } from "@/lib/errors/app-error";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

const CATEGORY_LABEL_KEY: Record<string, "capsules" | "ground" | "beans"> = {
  capsules: "capsules",
  "cafe-moulu": "ground",
  "cafe-en-grains": "beans",
};

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  if (!isValidProductSlug(slug)) return null;
  return getProductBySlug(slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await loadProduct(slug).catch(() => null);
  if (!product) return {};

  return {
    title: `${product.brand} ${product.name} — COFEO`,
    description: product.shortDescription || product.description.slice(0, 160) || undefined,
    alternates: {
      canonical: `/${locale}/machines/${slug}`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `/${l}/machines/${slug}`]),
      ),
    },
    // Demo/test product data — not for search engines yet.
    robots: { index: false },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!isValidProductSlug(slug)) {
    notFound();
  }

  const t = await getTranslations("Product");
  const catalogueT = await getTranslations("Catalogue");
  const findYourMachineT = await getTranslations("FindYourMachine");
  const usedRefurbishedT = await getTranslations("UsedRefurbished");

  let product: ProductDetail | null;
  try {
    product = await loadProduct(slug);
  } catch (error) {
    // Unexpected Store API failure — let the route error boundary
    // handle it rather than rendering a partial/broken page.
    throw error instanceof AppError ? error : new AppError("SERVER_ERROR", "Unknown error");
  }

  if (!product) {
    notFound();
  }

  const primaryCategory = product.categories[0];
  const categoryLabel = primaryCategory
    ? (CATEGORY_LABEL_KEY[primaryCategory.slug]
        ? findYourMachineT(CATEGORY_LABEL_KEY[primaryCategory.slug])
        : primaryCategory.name)
    : undefined;

  const breadcrumbItems = [
    { label: catalogueT("heading"), href: "/machines" },
    ...(primaryCategory && categoryLabel
      ? [{ label: categoryLabel, href: `/machines?category=${primaryCategory.slug}` }]
      : []),
    { label: product.name },
  ];

  // Trust narrative only applies to used/refurbished units — a new
  // machine has nothing to reassure a buyer about. Only the confirmed
  // process framing already established on the Homepage is reused here
  // — no new claims are introduced for this specific product.
  const showTrust = product.condition && product.condition !== "new";
  const trustSteps = [
    usedRefurbishedT("steps.selection"),
    usedRefurbishedT("steps.inspection"),
    usedRefurbishedT("steps.testing"),
    usedRefurbishedT("steps.cleaning"),
    usedRefurbishedT("steps.preparation"),
    usedRefurbishedT("steps.warranty"),
  ];

  let related: Awaited<ReturnType<typeof getProducts>>["products"] = [];
  if (primaryCategory) {
    try {
      const result = await getProducts({ category: primaryCategory.slug });
      related = result.products.filter((item) => item.id !== product.id).slice(0, 8);
    } catch {
      // Related products are a non-critical enhancement — fail silently
      // and just hide the section rather than breaking the whole page.
      related = [];
    }
  }

  return (
    <Section>
      <Container>
        <Breadcrumb items={breadcrumbItems} label={t("breadcrumbLabel")} />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
          <ProductGallery images={product.images} />

          <div className="flex flex-col gap-5 lg:sticky lg:top-8 lg:h-fit">
            <p className="text-caption tracking-wide text-text-muted uppercase">
              <bdi>{product.brand}</bdi>
            </p>
            <Heading level={1} size="xl">
              <bdi>{product.name}</bdi>
            </Heading>

            {(product.condition || product.badges.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {product.condition && (
                  <span className="inline-flex items-center rounded-full border border-border-strong px-3 py-1 text-caption font-medium text-text-primary">
                    {t(`condition.${product.condition}`)}
                  </span>
                )}
                {product.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center rounded-full border border-border-strong px-3 py-1 text-caption font-medium text-text-primary"
                  >
                    {t(`badges.${badge}`)}
                  </span>
                ))}
              </div>
            )}

            {product.available ? (
              <Price amount={product.price} originalAmount={product.originalPrice} size="large" />
            ) : (
              <p className="text-body text-text-muted">{t("outOfStock")}</p>
            )}

            <Divider />

            {product.shortDescription && (
              <p className="whitespace-pre-line text-body-s text-text-secondary">
                <bdi>{product.shortDescription}</bdi>
              </p>
            )}

            <AddToCartBox productId={product.id} productName={product.name} available={product.available} />

            {(categoryLabel || product.sku || (product.warranty && product.available)) && (
              <>
                <Divider />
                <div className="flex flex-col gap-4">
                  <p className="text-caption font-medium tracking-wide text-text-muted uppercase">
                    {t("specificationsHeading")}
                  </p>
                  <div className="flex flex-col gap-3">
                    {categoryLabel && (
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-primary"
                          aria-hidden="true"
                        >
                          <TagIcon />
                        </span>
                        <span className="text-body-s text-text-secondary">
                          <span className="text-text-muted">{t("categoryLabel")}: </span>
                          {categoryLabel}
                        </span>
                      </div>
                    )}
                    {product.sku && (
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-primary"
                          aria-hidden="true"
                        >
                          <SkuIcon />
                        </span>
                        <span className="text-body-s text-text-secondary">
                          <span className="text-text-muted">{t("skuLabel")}: </span>
                          <bdi>{product.sku}</bdi>
                        </span>
                      </div>
                    )}
                    {product.warranty && product.available && (
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-primary"
                          aria-hidden="true"
                        >
                          <ShieldIcon />
                        </span>
                        <span className="text-body-s text-text-secondary">{t("warranty")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {product.description && (
          <>
            <Divider className="my-12" />
            <div className="max-w-2xl">
              <Heading level={2} size="s" className="mb-4 text-text-muted">
                {t("descriptionHeading")}
              </Heading>
              <p className="whitespace-pre-line text-body text-text-secondary">
                <bdi>{product.description}</bdi>
              </p>
            </div>
          </>
        )}

        {showTrust && (
          <>
            <Divider className="my-12" />
            <div>
              <Heading level={2} size="l">
                {usedRefurbishedT("heading")}
              </Heading>
              <p className="mt-4 max-w-2xl text-body-l text-text-secondary">
                {usedRefurbishedT("supporting")}
              </p>
              <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
                {trustSteps.map((label, index) => (
                  <ProcessStep key={label} step={index + 1} label={label} />
                ))}
              </div>
            </div>
          </>
        )}

        {related.length > 0 && (
          <>
            <Divider className="my-12" />
            <RelatedProducts products={related} />
          </>
        )}
      </Container>
    </Section>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8l8-8A2 2 0 0 1 11 3Z" />
      <circle cx="15.5" cy="8.5" r="1.25" />
    </svg>
  );
}

function SkuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path strokeLinecap="round" d="M7 6v12M10 6v12M15 6v12M18 6v12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}
