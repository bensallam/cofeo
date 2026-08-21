import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { BankDetailsCard } from "@/components/checkout/bank-details-card";
import { BANK_TRANSFER_METHOD_ID } from "@/lib/woocommerce/payment-methods";
import type { PlacedOrder } from "@/lib/woocommerce/checkout";
import type { BankTransferDetails } from "@/lib/woocommerce/bank-transfer";

type OrderConfirmationProps = {
  order: PlacedOrder;
  bankTransferDetails: BankTransferDetails;
};

/**
 * Renders ONLY real data returned by WooCommerce's own checkout
 * response (order number, items, total, delivery city, payment
 * method) — nothing here is fabricated or re-derived. This component
 * only ever mounts after a real placeOrderAction success; there is no
 * route/state that can reach it otherwise (see CheckoutForm).
 */
export function OrderConfirmation({ order, bankTransferDetails }: OrderConfirmationProps) {
  const t = useTranslations("Checkout");
  const isBankTransfer = order.paymentMethod === BANK_TRANSFER_METHOD_ID;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-text-primary text-body-l text-text-inverse"
        aria-hidden="true"
      >
        ✓
      </div>

      <div className="flex flex-col gap-2">
        <Heading level={2} size="l">
          {isBankTransfer ? t("bankTransfer.confirmedTitle") : t("orderConfirmedTitle")}
        </Heading>
        <p className="text-body text-text-secondary">
          {isBankTransfer
            ? t("bankTransfer.confirmedDescription", { orderNumber: order.orderNumber })
            : t("orderConfirmedDescription", { orderNumber: order.orderNumber })}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <div className="flex justify-between text-body-s">
          <span className="text-text-muted">{t("orderNumberLabel")}</span>
          <span className="text-text-primary">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between text-body-s">
          <span className="text-text-muted">{t("orderStatusLabel")}</span>
          <span className="text-text-primary">{order.status}</span>
        </div>
        <div className="flex justify-between text-body-s">
          <span className="text-text-muted">{t("cityLabel")}</span>
          <span className="text-text-primary">{order.shippingCity}</span>
        </div>
        {isBankTransfer && (
          <div className="flex justify-between text-body-s">
            <span className="text-text-muted">{t("paymentMethodLabel")}</span>
            <span className="text-text-primary">{t("paymentMethods.bank_transfer")}</span>
          </div>
        )}

        <ul className="flex flex-col gap-2 border-t border-border pt-4">
          {order.items.map((item) => (
            <li key={item.name} className="flex justify-between text-body-s text-text-secondary">
              <span>
                <bdi>{item.name}</bdi> × {item.quantity}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between border-t border-border pt-3 text-body-l font-medium">
          <span className="text-text-primary">{t("totalLabel")}</span>
          <span className="text-text-primary">
            <Price amount={order.total} currency={order.currency} size="large" />
          </span>
        </div>
      </div>

      {isBankTransfer && (
        <div className="flex flex-col gap-3">
          <p className="text-body-s text-text-secondary">{t("bankTransfer.confirmedInstructions")}</p>
          <BankDetailsCard details={bankTransferDetails} amount={order.total} currency={order.currency} />
        </div>
      )}

      <Button variant="secondary" href="/machines" className="w-full rounded-xl py-3.5">
        {t("backToCatalogue")}
      </Button>
    </div>
  );
}
