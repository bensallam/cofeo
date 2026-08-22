import { useTranslations } from "next-intl";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import type { Cart } from "@/lib/woocommerce/cart-types";

/**
 * "Discount" reuses the existing Cart.discountLabel translation (already
 * shipped for the /cart page) rather than adding a new Checkout-scoped
 * key — this row only renders when the real cart carries a non-zero
 * discount, never a fabricated line.
 */

type OrderReviewProps = {
  cart: Cart;
  isShippingPending?: boolean;
};

/**
 * Product images come from `item.image`, itself mapped from the Store
 * API cart response's own `images[0]` (see lib/woocommerce/cart.ts) —
 * never invented. Falls back to the same placeholder treatment as
 * ProductCard when a line item genuinely has none.
 */
export function OrderReview({ cart, isShippingPending = false }: OrderReviewProps) {
  const t = useTranslations("Checkout");
  const tCart = useTranslations("Cart");

  return (
    <div className="flex flex-col gap-5 rounded-(--radius-card) border border-border bg-surface/40 p-8 backdrop-blur-xl backdrop-saturate-150">
      <h2 className="text-body-l font-medium text-text-primary">{t("orderSummaryHeading")}</h2>

      <ul className="flex flex-col divide-y divide-border">
        {cart.items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-card) bg-bg">
              <ProductImage
                src={item.image?.src}
                alt={item.image?.alt ?? item.name}
                sizes="80px"
                placeholderClassName="text-center text-[0.625rem]"
              />
            </div>
            <div className="flex flex-1 items-start justify-between gap-3">
              <div className="flex flex-col gap-1 text-body-s">
                <span className="font-medium text-text-primary">
                  <bdi>{item.name}</bdi>
                </span>
                <span className="text-text-muted">× {item.quantity}</span>
              </div>
              <span className="shrink-0 text-text-primary">
                <Price amount={item.lineTotal} currency={cart.currency} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-body-s">
        <div className="flex justify-between">
          <dt className="text-text-muted">{t("subtotalLabel")}</dt>
          <dd className="text-text-primary">
            <Price amount={cart.subtotal} currency={cart.currency} />
          </dd>
        </div>
        {cart.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-text-muted">{tCart("discountLabel")}</dt>
            <dd className="text-text-primary">
              −<Price amount={cart.discount} currency={cart.currency} />
            </dd>
          </div>
        )}
        <div className="flex justify-between" aria-live="polite">
          <dt className="text-text-muted">{t("shippingLabel")}</dt>
          <dd className="text-text-primary">
            {isShippingPending ? (
              <span className="text-text-muted">{t("shippingCalculating")}</span>
            ) : cart.shippingCost === null ? (
              <span className="text-text-muted">{t("shippingUnknown")}</span>
            ) : cart.shippingCost === 0 ? (
              <span>{t("shippingFree")}</span>
            ) : (
              <Price amount={cart.shippingCost} currency={cart.currency} />
            )}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-body-l font-medium" aria-live="polite">
          <dt className="text-text-primary">{t("totalLabel")}</dt>
          <dd className="text-text-primary">
            <Price amount={cart.total} currency={cart.currency} size="large" />
          </dd>
        </div>
      </dl>
    </div>
  );
}
