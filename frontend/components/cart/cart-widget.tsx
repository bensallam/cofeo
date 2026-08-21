"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconButton } from "@/components/ui/icon-button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { CartIcon } from "@/components/cart/cart-icon";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { useCart } from "@/lib/cart/use-cart";

/**
 * Deliberately fetches its own cart client-side on mount (see
 * lib/cart/use-cart.ts) rather than receiving it as a prop from the
 * Server Component Header — Header calling cookies()/the Store API
 * would force every route in the app into dynamic rendering, losing
 * Homepage/design-system's static prerendering for a badge count.
 */
export function CartWidget() {
  const t = useTranslations("Cart");
  const [isOpen, setIsOpen] = React.useState(false);
  const { cart, errorCode, availableQuantity, updateQuantity, remove } = useCart(null);

  return (
    <>
      <IconButton
        aria-label={t("openCartLabel", { count: cart.itemsCount })}
        onClick={() => setIsOpen(true)}
        variant="ghost-inverse"
        className="relative"
      >
        <CartIcon />
        {cart.itemsCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -end-1 -top-1 inline-flex size-4 items-center justify-center rounded-full bg-error text-[10px] font-medium text-text-inverse tabular-nums"
          >
            {cart.itemsCount > 9 ? "9+" : cart.itemsCount}
          </span>
        )}
      </IconButton>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("miniCartTitle")}>

        {errorCode && (
          <p role="alert" className="text-body-s text-error">
            {errorCode === "OUT_OF_STOCK" &&
              (availableQuantity !== undefined
                ? t("maxAvailableQuantity", { max: availableQuantity })
                : t("errorOutOfStock"))}
            {errorCode === "VALIDATION_ERROR" && t("errorValidation")}
            {errorCode !== "OUT_OF_STOCK" && errorCode !== "VALIDATION_ERROR" && t("errorGeneric")}
          </p>
        )}

        {cart.items.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} className="py-8" />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
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
            <CartSummary cart={cart} />
          </>
        )}

        <Link
          href="/cart"
          onClick={() => setIsOpen(false)}
          className="mt-auto inline-flex items-center justify-center rounded-(--radius-control) border border-button-secondary-border bg-button-secondary-bg px-4 py-2.5 text-body-s font-medium text-button-secondary-text transition-colors duration-200 hover:bg-surface-hover"
        >
          {t("viewCart")}
        </Link>
      </Drawer>
    </>
  );
}
