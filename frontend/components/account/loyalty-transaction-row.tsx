import { useTranslations, useLocale } from "next-intl";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatOrderDate } from "@/lib/i18n/date";
import type { LoyaltyTransaction } from "@/lib/woocommerce/loyalty";
import type { Locale } from "@/i18n/routing";

type LoyaltyTransactionRowProps = {
  transaction: LoyaltyTransaction;
};

/**
 * One row in /account/loyalty's history list. Only ever rendered from
 * a summary the server already scoped to the authenticated customer
 * (getLoyaltySummaryForCustomer) — same "no ownership check of its
 * own, the caller already did it" posture as OrderListCard.
 */
export function LoyaltyTransactionRow({ transaction }: LoyaltyTransactionRowProps) {
  const t = useTranslations("Loyalty");
  const locale = useLocale() as Locale;
  const isEarn = transaction.type === "EARN";

  return (
    <Card className="flex flex-row items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-body-s font-medium text-text-primary">{t(`reason.${transaction.reason}`)}</span>
        <span className="text-caption text-text-muted">{formatOrderDate(transaction.createdAt, locale)}</span>
        <Link
          href={`/account/orders/${transaction.orderId}`}
          className="text-caption text-text-secondary underline underline-offset-2 hover:text-text-primary"
        >
          {t("viewOrderCta", { number: transaction.orderId })}
        </Link>
      </div>

      <span
        className={
          "shrink-0 text-body-l font-semibold tabular-nums " + (isEarn ? "text-success" : "text-error")
        }
      >
        {t(isEarn ? "pointsEarned" : "pointsReversed", { points: transaction.points })}
      </span>
    </Card>
  );
}
