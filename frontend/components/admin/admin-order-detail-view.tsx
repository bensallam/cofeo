import { useTranslations, useLocale } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { OrderStatusTimeline } from "@/components/checkout/order-status-timeline";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { AdminOrderLoyaltySection } from "@/components/admin/admin-order-loyalty-section";
import { formatOrderDate } from "@/lib/i18n/date";
import type { OrderDetails } from "@/lib/woocommerce/order";
import type { LoyaltySummary, LoyaltyTransaction } from "@/lib/woocommerce/loyalty";
import type { Locale } from "@/i18n/routing";

type AdminOrderDetailViewProps = {
  order: OrderDetails;
  loyaltyTransactions: LoyaltyTransaction[];
  /** `null` for a guest order (`order.customerId <= 0`) — see
   *  AdminOrderLoyaltySection's own docblock. */
  loyaltyCustomerBalance: LoyaltySummary["balance"] | null;
};

/**
 * The admin counterpart of `OrderDetailView` (components/account/) —
 * deliberately reuses the exact same `OrderStatusBadge` and
 * `OrderStatusTimeline` (history, corrections, and all) rather than
 * building a second status-display implementation; the only genuinely
 * new piece is `OrderStatusControl`, the status-change UI itself.
 * Everything this renders comes from the same `OrderDetails` shape
 * the customer-facing view already consumes — no separate admin data
 * model exists.
 */
export function AdminOrderDetailView({ order, loyaltyTransactions, loyaltyCustomerBalance }: AdminOrderDetailViewProps) {
  const t = useTranslations("Checkout");
  const tc = useTranslations("Checkout.orderConfirmation");
  const ta = useTranslations("Admin");
  const locale = useLocale() as Locale;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Heading level={1} size="xl">
          {ta("orderDetailsHeading", { number: order.orderNumber })}
        </Heading>
        <div className="flex flex-wrap items-center gap-3 text-body-s text-text-secondary">
          <span>{formatOrderDate(order.dateCreated, locale)}</span>
          <OrderStatusBadge status={order.cofeoStatus} />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
        <h2 className="text-body-l font-medium text-text-primary">{ta("changeStatusHeading")}</h2>
        <OrderStatusControl orderId={order.orderId} currentStatus={order.cofeoStatus} />
      </div>

      <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
        <h2 className="text-body-l font-medium text-text-primary">{tc("timelineHeading")}</h2>
        <OrderStatusTimeline status={order.cofeoStatus} history={order.statusHistory} />
      </div>

      <AdminOrderLoyaltySection transactions={loyaltyTransactions} customerBalance={loyaltyCustomerBalance} />

      <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
        <h2 className="text-body-l font-medium text-text-primary">{ta("customerHeading")}</h2>
        <dl className="flex flex-col gap-2.5 text-body-s">
          {order.customerName && <Row label={t("fullNameLabel")} value={<bdi>{order.customerName}</bdi>} />}
          {order.customerEmail && <Row label={t("emailLabel")} value={<bdi dir="ltr">{order.customerEmail}</bdi>} />}
          {order.customerPhone && <Row label={t("phoneLabel")} value={<bdi dir="ltr">{order.customerPhone}</bdi>} />}
          {order.shippingAddress1 && <Row label={t("address1Label")} value={<bdi>{order.shippingAddress1}</bdi>} />}
          {order.shippingCity && <Row label={t("cityLabel")} value={<bdi>{order.shippingCity}</bdi>} />}
        </dl>
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
                  <span className="text-text-muted tabular-nums">× {item.quantity}</span>
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

      {order.paymentMethodTitle && (
        <div className="flex flex-col gap-4 rounded-(--radius-card) border border-border bg-surface p-6">
          <h2 className="text-body-l font-medium text-text-primary">{ta("paymentHeading")}</h2>
          <dl className="flex flex-col gap-2.5 text-body-s">
            <Row label={t("paymentMethodLabel")} value={order.paymentMethodTitle} />
          </dl>
        </div>
      )}

      <Button variant="secondary" href="/admin/orders" className="w-full rounded-xl py-3.5">
        {ta("backToOrders")}
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
