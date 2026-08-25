import { useTranslations, useLocale } from "next-intl";
import { Card } from "@/components/ui/card";
import { Price } from "@/components/ui/price";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/checkout/order-status-badge";
import { formatOrderDate } from "@/lib/i18n/date";
import type { OrderDetails } from "@/lib/woocommerce/order";
import type { Locale } from "@/i18n/routing";

type AdminOrderListRowProps = {
  order: OrderDetails;
};

/**
 * One row in /admin/orders. Only ever rendered from a list the server
 * already fetched via `getOrdersForAdmin()` — the page itself is what
 * enforces the ADMIN-only access boundary (see that page's own
 * docblock); this component does no authorization check of its own,
 * the same posture `OrderListCard` already has toward the customer
 * account list it renders in.
 *
 * Reuses `OrderStatusBadge` as-is — no separate admin status-display
 * logic exists or is needed.
 */
export function AdminOrderListRow({ order }: AdminOrderListRowProps) {
  const t = useTranslations("Admin");
  const locale = useLocale() as Locale;

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-body-l font-semibold text-text-primary">#{order.orderNumber}</span>
        <span className="text-body-s text-text-secondary">
          <bdi>{order.customerName || t("guestCustomer")}</bdi>
        </span>
        <span className="text-caption text-text-muted">{formatOrderDate(order.dateCreated, locale)}</span>
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        <OrderStatusBadge status={order.cofeoStatus} />
        <Price amount={order.total} currency={order.currency} size="large" />
        <Button variant="secondary" href={`/admin/orders/${order.orderId}`} className="w-full sm:w-auto">
          {t("viewOrderCta")}
        </Button>
      </div>
    </Card>
  );
}
