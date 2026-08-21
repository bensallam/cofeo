import { useTranslations } from "next-intl";
import { Price } from "@/components/ui/price";
import type { Cart } from "@/lib/woocommerce/cart-types";

type CartSummaryProps = {
  cart: Cart;
};

/**
 * Totals only — no checkout CTA here by design (Phase 6 scope), the
 * button lives in the parent panel alongside this. The heading and the
 * shipping row's null/0/amount copy both reuse Checkout's existing
 * translation keys verbatim (Checkout.orderSummaryHeading,
 * Checkout.shippingLabel/shippingFree/shippingUnknown) rather than
 * duplicating new Cart-scoped strings — same cross-namespace reuse
 * OrderReview already does for Cart.discountLabel, just the mirror
 * direction.
 */
export function CartSummary({ cart }: CartSummaryProps) {
  const t = useTranslations("Cart");
  const tCheckout = useTranslations("Checkout");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-body-l font-medium text-text-primary">{tCheckout("orderSummaryHeading")}</h2>
      <dl className="flex flex-col gap-2 text-body-s">
        <div className="flex justify-between">
          <dt className="text-text-muted">{t("subtotalLabel")}</dt>
          <dd className="text-text-primary">
            <Price amount={cart.subtotal} currency={cart.currency} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">{tCheckout("shippingLabel")}</dt>
          <dd className="text-text-primary">
            {cart.shippingCost === null ? (
              <span className="text-text-muted">{tCheckout("shippingUnknown")}</span>
            ) : cart.shippingCost === 0 ? (
              <span>{tCheckout("shippingFree")}</span>
            ) : (
              <Price amount={cart.shippingCost} currency={cart.currency} />
            )}
          </dd>
        </div>
        {cart.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-text-muted">{t("discountLabel")}</dt>
            <dd className="text-text-primary">
              <Price amount={-cart.discount} currency={cart.currency} />
            </dd>
          </div>
        )}
        {cart.tax > 0 && (
          <div className="flex justify-between">
            <dt className="text-text-muted">{t("taxLabel")}</dt>
            <dd className="text-text-primary">
              <Price amount={cart.tax} currency={cart.currency} />
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-body font-medium">
          <dt className="text-text-primary">{t("totalLabel")}</dt>
          <dd className="text-text-primary">
            <Price amount={cart.total} currency={cart.currency} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
