"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { formatPrice } from "@/lib/i18n/price";
import type { Locale } from "@/i18n/routing";
import type { CartItem } from "@/lib/woocommerce/cart-types";

type CartLineItemProps = {
  item: CartItem;
  currency: string;
  onUpdateQuantity: (key: string, quantity: number) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
};

export function CartLineItem({ item, currency, onUpdateQuantity, onRemove }: CartLineItemProps) {
  const t = useTranslations("Cart");
  const locale = useLocale() as Locale;
  const [isRemoving, startRemoveTransition] = React.useTransition();

  function handleRemove() {
    if (isRemoving) return;
    startRemoveTransition(async () => {
      await onRemove(item.key);
    });
  }

  return (
    <div className="flex gap-4 rounded-(--radius-card) border border-border bg-surface/40 p-4 backdrop-blur-xl backdrop-saturate-150">
      <Link
        href={`/machines/${item.slug}`}
        className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-control) bg-surface-hover"
      >
        <ProductImage
          src={item.image?.src}
          alt={item.image?.alt ?? item.name}
          sizes="96px"
          placeholderClassName="text-center text-caption"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/machines/${item.slug}`}
            className="min-w-0 flex-1 truncate text-body font-medium text-text-primary"
          >
            <bdi>{item.name}</bdi>
          </Link>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            aria-label={t("removeItemLabel", { name: item.name })}
            className="shrink-0 text-caption text-text-muted underline decoration-dotted transition-colors duration-200 hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            {t("removeLabel")}
          </button>
        </div>

        <span className="text-body-s text-text-muted tabular-nums">
          {formatPrice(item.unitPrice, locale, currency)}
        </span>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            quantity={item.quantity}
            min={item.quantityMin}
            max={item.quantityMax}
            label={item.name}
            onChange={(quantity) => onUpdateQuantity(item.key, quantity)}
            disabled={isRemoving}
          />
          <Price amount={item.lineTotal} currency={currency} />
        </div>
      </div>
    </div>
  );
}
