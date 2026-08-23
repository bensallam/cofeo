import { useTranslations, useLocale } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { BankDetailsCard } from "@/components/checkout/bank-details-card";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { OrderStatusTimeline } from "@/components/checkout/order-status-timeline";
import { BANK_TRANSFER_METHOD_ID } from "@/lib/woocommerce/payment-methods";
import { formatOrderDate } from "@/lib/i18n/date";
import { formatPrice } from "@/lib/i18n/price";
import type { OrderDetails } from "@/lib/woocommerce/order";
import type { BankTransferDetails } from "@/lib/woocommerce/bank-transfer";
import type { Locale } from "@/i18n/routing";

type OrderConfirmationProps = {
  order: OrderDetails;
  bankTransferDetails: BankTransferDetails;
};

/**
 * Renders ONLY real data returned by the WooCommerce order itself (see
 * lib/woocommerce/order.ts's `getOrderByKey`) — nothing here is
 * fabricated or re-derived. Any row whose underlying value is empty
 * (no phone on file, no address line, ...) is simply omitted rather
 * than shown blank or invented.
 */
export function OrderConfirmation({ order, bankTransferDetails }: OrderConfirmationProps) {
  const t = useTranslations("Checkout");
  const tc = useTranslations("Checkout.orderConfirmation");
  const locale = useLocale() as Locale;
  const isBankTransfer = order.paymentMethod === BANK_TRANSFER_METHOD_ID;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex size-14 items-center justify-center rounded-full bg-success-surface text-heading-s text-success"
          aria-hidden="true"
        >
          ✓
        </div>
        <div className="flex flex-col gap-1.5">
          <Heading level={1} size="l">
            {tc("title")}
          </Heading>
          <p className="text-body text-text-secondary">{tc("thanks")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
        <h2 className="text-body-l font-medium text-text-primary">{tc("orderInfoHeading")}</h2>
        <dl className="flex flex-col gap-2.5 text-body-s">
          <Row label={t("orderNumberLabel")} value={order.orderNumber} />
          <Row label={tc("dateLabel")} value={formatOrderDate(order.dateCreated, locale)} />
          <Row label={t("orderStatusLabel")} value={<OrderStatusBadge status={order.cofeoStatus} />} />
          {order.paymentMethodTitle && <Row label={t("paymentMethodLabel")} value={order.paymentMethodTitle} />}
        </dl>
      </div>

      <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
        <h2 className="text-body-l font-medium text-text-primary">{tc("timelineHeading")}</h2>
        <OrderStatusTimeline status={order.cofeoStatus} />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-body-l font-medium text-text-primary">{tc("yourProductsHeading")}</h2>
        <ul className="flex flex-col divide-y divide-border rounded-(--radius-card) border border-border bg-surface">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center gap-4 p-4">
              <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-control) bg-bg">
                <ProductImage src={item.imageSrc} alt={item.name} sizes="64px" placeholderClassName="text-[0.625rem]" />
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 text-body-s">
                  <span className="font-medium text-text-primary">
                    <bdi>{item.name}</bdi>
                  </span>
                  <span className="text-text-muted tabular-nums">
                    <bdi dir="ltr">
                      {formatPrice(item.unitPrice, locale, order.currency)} × {item.quantity}
                    </bdi>
                  </span>
                </div>
                <Price amount={item.total} currency={order.currency} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
        <h2 className="text-body-l font-medium text-text-primary">{tc("summaryHeading")}</h2>
        <dl className="flex flex-col gap-2 text-body-s">
          <div className="flex justify-between">
            <dt className="text-text-muted">{t("subtotalLabel")}</dt>
            <dd className="text-text-primary">
              <Price amount={order.subtotal} currency={order.currency} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">{t("shippingLabel")}</dt>
            <dd className="text-text-primary">
              {order.shippingTotal === 0 ? (
                <span>{t("shippingFree")}</span>
              ) : (
                <Price amount={order.shippingTotal} currency={order.currency} />
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-body-l font-medium">
            <dt className="text-text-primary">{t("totalLabel")}</dt>
            <dd className="text-text-primary">
              <Price amount={order.total} currency={order.currency} size="large" />
            </dd>
          </div>
        </dl>
      </div>

      {(order.customerName ||
        order.customerEmail ||
        order.shippingAddress1 ||
        order.shippingCity ||
        order.customerPhone) && (
        <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
          <h2 className="text-body-l font-medium text-text-primary">{tc("shippingAddressHeading")}</h2>
          <dl className="flex flex-col gap-2.5 text-body-s">
            {order.customerName && <Row label={t("fullNameLabel")} value={order.customerName} />}
            {order.customerEmail && (
              <Row label={t("emailLabel")} value={<bdi dir="ltr">{order.customerEmail}</bdi>} />
            )}
            {order.shippingAddress1 && (
              <Row label={t("address1Label")} value={<bdi>{order.shippingAddress1}</bdi>} />
            )}
            {order.shippingCity && <Row label={t("cityLabel")} value={<bdi>{order.shippingCity}</bdi>} />}
            {order.customerPhone && (
              <Row label={t("phoneLabel")} value={<bdi dir="ltr">{order.customerPhone}</bdi>} />
            )}
          </dl>
        </div>
      )}

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-end text-text-primary">{value}</dd>
    </div>
  );
}
