import { useTranslations } from "next-intl";
import type { LoyaltySummary, LoyaltyTransaction } from "@/lib/woocommerce/loyalty";

type AdminOrderLoyaltySectionProps = {
  /** This order's own EARN/REVERSAL rows — 0, 1, or (after multiple
   *  earn/reverse episodes) more. */
  transactions: LoyaltyTransaction[];
  /** The customer's overall balance — `null` for a guest order
   *  (`customerId <= 0`), which can never have a loyalty account (see
   *  wordpress/custom-plugin/loyalty/class-cofeo-loyalty.php). */
  customerBalance: LoyaltySummary["balance"] | null;
};

/**
 * Admin-only, read-only view of this order's loyalty activity (Phase
 * 4E §11 — "only if it can be done cleanly within the existing Phase
 * 4D admin architecture"). No mutation control of any kind: every
 * ledger write originates exclusively from the WordPress-side
 * `woocommerce_order_status_changed` listener, never from a browser
 * request, admin included — see class-cofeo-loyalty.php's own
 * docblock. This component only reads props already fetched
 * server-side by the page (admin/orders/[id]/page.tsx), which itself
 * runs behind the exact same two-tier ADMIN gate every other admin
 * route uses.
 */
export function AdminOrderLoyaltySection({ transactions, customerBalance }: AdminOrderLoyaltySectionProps) {
  const t = useTranslations("Admin");
  const tl = useTranslations("Loyalty");

  return (
    <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body-l font-medium text-text-primary">{t("loyaltyHeading")}</h2>
        {customerBalance !== null && (
          <span className="text-body-s tabular-nums text-text-secondary">
            {t("loyaltyCustomerBalance", { balance: customerBalance })}
          </span>
        )}
      </div>

      {transactions.length === 0 ? (
        <p className="text-body-s text-text-muted">{t("loyaltyEmptyTitle")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {transactions.map((transaction) => (
            <li
              key={`${transaction.episode}-${transaction.type}`}
              className="flex items-center justify-between gap-3 py-2.5 text-body-s"
            >
              <span className="text-text-primary">{tl(`reason.${transaction.reason}`)}</span>
              <span
                className={
                  "tabular-nums font-medium " +
                  (transaction.type === "EARN" ? "text-success" : "text-error")
                }
              >
                {tl(transaction.type === "EARN" ? "pointsEarned" : "pointsReversed", { points: transaction.points })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
