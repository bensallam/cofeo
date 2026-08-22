import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Divider } from "@/components/ui/divider";
import { CartPageClient } from "@/components/cart/cart-page-client";
import { getCurrentCart } from "@/lib/cart/current-cart";
import { getProductBySlug, getProducts, type CatalogueProduct } from "@/lib/woocommerce/products";
import type { Cart } from "@/lib/woocommerce/cart-types";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cart" });

  return {
    title: `${t("heading")} — COFEO`,
    alternates: {
      canonical: `/${locale}/cart`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/cart`])),
    },
    // A cart is per-visitor and never worth indexing.
    robots: { index: false },
  };
}

/**
 * Recommendation source: reuses the exact same category-based mechanism
 * the PDP already uses for its own "You might also like" (getProducts()
 * scoped to a category), just anchored on the cart's own items instead
 * of a single product page. The Store API cart response carries no
 * category/taxonomy data per line item (see lib/woocommerce/cart.ts),
 * so the first cart item's own category is looked up via the existing
 * getProductBySlug() — no new backend endpoint, no new fetch pattern.
 * Any failure (network, no category anywhere in the cart) yields an
 * empty list rather than a broken section, same as the PDP's own
 * "non-critical enhancement" fallback.
 */
async function getCartRecommendations(cart: Cart): Promise<CatalogueProduct[]> {
  try {
    const cartProductIds = new Set(cart.items.map((item) => item.productId));
    const details = await Promise.all(cart.items.map((item) => getProductBySlug(item.slug)));
    const primaryCategory = details.find((detail) => detail && detail.categories[0])?.categories[0];
    if (!primaryCategory) return [];

    const result = await getProducts({ category: primaryCategory.slug });
    const seen = new Set<number>();
    return result.products
      .filter((product) => {
        if (cartProductIds.has(product.id) || seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

export default async function CartPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Cart");
  const productT = await getTranslations("Product");
  const cart = await getCurrentCart();
  const itemCountText = cart.itemsCount > 0 ? t("itemCount", { count: cart.itemsCount }) : null;
  const relatedProducts = cart.items.length > 0 ? await getCartRecommendations(cart) : [];

  return (
    <Section tone="dark">
      <Container>
        <Breadcrumb items={[{ label: t("heading") }]} label={productT("breadcrumbLabel")} />

        <div className="flex items-baseline justify-between gap-4">
          <Heading level={1} size="xl">
            {t("heading")}
          </Heading>
          {itemCountText && <p className="text-body-s text-text-muted">{itemCountText}</p>}
        </div>

        <Divider className="mt-6 mb-10" />

        <CartPageClient initialCart={cart} relatedProducts={relatedProducts} />
      </Container>
    </Section>
  );
}
