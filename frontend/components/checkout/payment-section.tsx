import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BankDetailsCard } from "@/components/checkout/bank-details-card";
import { BANK_TRANSFER_METHOD_ID } from "@/lib/woocommerce/payment-methods";
import type { BankTransferDetails } from "@/lib/woocommerce/bank-transfer";

const KNOWN_METHOD_LABEL_KEYS: Record<string, string> = {
  cod: "cod",
  bacs: "bacs",
  cheque: "cheque",
  [BANK_TRANSFER_METHOD_ID]: "bank_transfer",
};

/** Only labelKeys with a corresponding `paymentMethods.<key>Hint`
 * message actually defined — next-intl throws on a missing key, so
 * this must never be looked up speculatively for `bacs`/`cheque`. */
const HINT_LABEL_KEYS = new Set(["cod", "bank_transfer"]);

/** Monochrome line icons only (currentColor, no fill) — a method with
 * no entry here just renders without a badge, never blocks it from
 * being offered. */
const KNOWN_METHOD_ICONS: Record<string, ReactNode> = {
  cod: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M6 9h.01M18 15h.01" />
    </svg>
  ),
  [BANK_TRANSFER_METHOD_ID]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5M4.5 10.5v8M9 10.5v8M15 10.5v8M19.5 10.5v8M2.5 20.5h19" />
    </svg>
  ),
};

type PaymentSectionProps = {
  paymentMethods: string[];
  selected: string;
  onChange: (method: string) => void;
  error?: string;
  bankTransferDetails: BankTransferDetails;
  amount: number;
  currency: string;
};

/**
 * Entirely data-driven — never assumes COD or any specific gateway is
 * available. Renders a real radio group only for whatever
 * `paymentMethods` Store API's own checkout draft is currently
 * offering. Known built-in gateway ids get a friendly translated
 * label/hint/icon; anything else falls back to showing the raw id with
 * no icon rather than inventing one. The bank-transfer info panel only
 * ever appears when that method's own id is both selected AND present
 * in the live `paymentMethods` list — it can never render while the
 * gateway is disabled server-side, since the id wouldn't be in that
 * list at all.
 */
export function PaymentSection({
  paymentMethods,
  selected,
  onChange,
  error,
  bankTransferDetails,
  amount,
  currency,
}: PaymentSectionProps) {
  const t = useTranslations("Checkout");

  return (
    <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface/40 p-8 backdrop-blur-xl backdrop-saturate-150">
      <h2 className="text-body-l font-medium text-text-primary">{t("paymentHeading")}</h2>

      {paymentMethods.length === 0 ? (
        <p className="text-body-s text-text-muted">{t("paymentNotAvailable")}</p>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{t("paymentHeading")}</legend>
          {paymentMethods.map((method) => {
            const labelKey = KNOWN_METHOD_LABEL_KEYS[method];
            const icon = KNOWN_METHOD_ICONS[method];
            const isSelected = selected === method;
            const isBankTransfer = method === BANK_TRANSFER_METHOD_ID;
            const hint = labelKey && HINT_LABEL_KEYS.has(labelKey) ? t(`paymentMethods.${labelKey}Hint`) : null;

            return (
              <div key={method}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-(--radius-card) border p-4 transition-colors duration-200 ${
                    isSelected ? "border-2 border-gold p-[calc(1rem-1px)]" : "border-border hover:border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={isSelected}
                    onChange={() => onChange(method)}
                    className="mt-0.5 accent-gold"
                  />
                  {icon && (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) bg-bg text-text-primary [&_svg]:size-4.5">
                      {icon}
                    </span>
                  )}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body-s font-medium text-text-primary">
                      {labelKey ? t(`paymentMethods.${labelKey}`) : method}
                    </span>
                    {hint && <span className="text-caption text-text-muted">{hint}</span>}
                  </span>
                </label>
                {isBankTransfer && isSelected && (
                  <div className="mt-3 ps-4">
                    <p className="mb-2 text-body-s font-medium text-text-primary">
                      {t("bankTransfer.panelHeading")}
                    </p>
                    <BankDetailsCard details={bankTransferDetails} amount={amount} currency={currency} />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}
    </div>
  );
}
