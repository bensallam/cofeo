import { useTranslations } from "next-intl";
import { Price } from "@/components/ui/price";
import { CopyButton } from "@/components/checkout/copy-button";
import type { BankTransferDetails } from "@/lib/woocommerce/bank-transfer";

type BankDetailsCardProps = {
  details: BankTransferDetails;
  amount: number;
  currency: string;
};

/**
 * Presentational only — every row is individually guarded so a
 * partially-filled admin config (e.g. no BIC yet) never renders an
 * empty label. Reused as-is on both the payment-method panel (Phase 10)
 * and the order confirmation page, so the customer sees identical
 * account details in both places.
 */
export function BankDetailsCard({ details, amount, currency }: BankDetailsCardProps) {
  const t = useTranslations("Checkout.bankTransfer");

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-card) border border-border bg-bg p-4 text-body-s">
      {details.accountHolder && (
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">{t("accountHolderLabel")}</span>
          <span className="text-text-primary">{details.accountHolder}</span>
        </div>
      )}
      {details.bankName && (
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">{t("bankNameLabel")}</span>
          <span className="text-text-primary">{details.bankName}</span>
        </div>
      )}
      {details.rib && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-muted">{t("ribLabel")}</span>
          <span className="flex items-center gap-2">
            <span dir="ltr" className="text-text-primary tabular-nums">
              {details.rib}
            </span>
            <CopyButton value={details.rib} />
          </span>
        </div>
      )}
      {details.iban && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-muted">{t("ibanLabel")}</span>
          <span className="flex items-center gap-2">
            <span dir="ltr" className="text-text-primary tabular-nums">
              {details.iban}
            </span>
            <CopyButton value={details.iban} />
          </span>
        </div>
      )}
      {details.bic && (
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">{t("bicLabel")}</span>
          <span dir="ltr" className="text-text-primary">
            {details.bic}
          </span>
        </div>
      )}

      <div className="flex justify-between gap-3 border-t border-border pt-3 font-medium">
        <span className="text-text-primary">{t("amountLabel")}</span>
        <Price amount={amount} currency={currency} />
      </div>

      <p className="text-caption text-text-muted">{t("instructionsNote")}</p>
      {details.instructions && <p className="text-caption text-text-muted">{details.instructions}</p>}
    </div>
  );
}
