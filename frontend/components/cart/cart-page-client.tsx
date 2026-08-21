"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { EmptyState } from "@/components/ui/empty-state";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { RelatedProducts } from "@/components/product/related-products";
import { useCart } from "@/lib/cart/use-cart";
import type { Cart } from "@/lib/woocommerce/cart-types";
import type { CatalogueProduct } from "@/lib/woocommerce/products";

type CartPageClientProps = {
  initialCart: Cart;
  relatedProducts: CatalogueProduct[];
};

export function CartPageClient({ initialCart, relatedProducts }: CartPageClientProps) {
  const t = useTranslations("Cart");
  const { cart, errorCode, availableQuantity, updateQuantity, remove } = useCart(initialCart);

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <Button variant="secondary" href="/machines">
            {t("continueShopping")}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_310px]">
        <div>
          {errorCode && (
            <p role="alert" className="mb-4 text-body-s text-error">
              {errorCode === "OUT_OF_STOCK" &&
                (availableQuantity !== undefined
                  ? t("maxAvailableQuantity", { max: availableQuantity })
                  : t("errorOutOfStock"))}
              {errorCode === "VALIDATION_ERROR" && t("errorValidation")}
              {errorCode !== "OUT_OF_STOCK" && errorCode !== "VALIDATION_ERROR" && t("errorGeneric")}
            </p>
          )}

          <div className="flex flex-col gap-4">
            {cart.items.map((item) => (
              <CartLineItem
                key={item.key}
                item={item}
                currency={cart.currency}
                onUpdateQuantity={updateQuantity}
                onRemove={remove}
              />
            ))}
          </div>

          <Link
            href="/machines"
            className="mt-6 inline-flex items-center gap-1.5 text-body-s text-text-muted underline decoration-dotted transition-colors duration-200 hover:text-text-primary"
          >
            <ContinueShoppingIcon />
            {t("continueShopping")}
          </Link>
        </div>

        <div className="flex flex-col gap-6 rounded-(--radius-card) border border-border bg-surface p-6 lg:sticky lg:top-8 lg:h-fit">
          <CartSummary cart={cart} />
          <Button variant="primary" href="/checkout">
            {t("proceedToCheckout")}
          </Button>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <>
          <Divider className="mt-16 mb-16" />
          <RelatedProducts products={relatedProducts} />
        </>
      )}
    </>
  );
}

function ContinueShoppingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 rtl:-scale-x-100" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
    </svg>
  );
}
