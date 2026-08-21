import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/i18n/price";
import { cn } from "@/lib/design/cn";
import type { Locale } from "@/i18n/routing";

type PriceProps = {
  /** null/undefined renders the "unavailable" state. */
  amount: number | null | undefined;
  /** Present + greater than `amount` renders a crossed-out original price. */
  originalAmount?: number;
  currency?: string;
  size?: "default" | "large";
  /** Prefixes the localized "from" / "à partir de" label. */
  from?: boolean;
  className?: string;
};

export function Price({
  amount,
  originalAmount,
  currency = "MAD",
  size = "default",
  from = false,
  className,
}: PriceProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Price");
  const sizeClass = size === "large" ? "text-price-lg" : "text-price";

  if (amount == null) {
    return (
      <span className={cn("text-body text-text-muted", className || null)}>
        {t("unavailable")}
      </span>
    );
  }

  const onSale = originalAmount != null && originalAmount > amount;

  return (
    <span
      className={cn("inline-flex items-baseline gap-2 tabular-nums", className || null)}
    >
      {from && <span className="text-body-s text-text-muted">{t("from")}</span>}
      <span
        className={cn(
          sizeClass,
          "font-semibold",
          onSale ? "text-error" : "text-text-primary",
        )}
      >
        {formatPrice(amount, locale, currency)}
      </span>
      {onSale && (
        <span className="text-body-s text-text-muted line-through">
          {formatPrice(originalAmount, locale, currency)}
        </span>
      )}
    </span>
  );
}
