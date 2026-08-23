import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CofeoStatusKey } from "@/lib/woocommerce/order-status";

const VARIANT: Record<CofeoStatusKey, "neutral" | "success" | "warning" | "error"> = {
  NEW: "neutral",
  CONFIRMED: "warning",
  PREPARING: "warning",
  SHIPPED: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  CANCELLED: "error",
};

type OrderStatusBadgeProps = {
  status: CofeoStatusKey;
  className?: string;
};

/**
 * Small status pill — reusable anywhere an order's current state needs
 * to fit in a single line (order info card, a future /account order
 * list row, ...). Pairs with `OrderStatusTimeline` for the fuller
 * step-by-step view.
 */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const t = useTranslations("Checkout.orderStatus");
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {t(`${status}.label`)}
    </Badge>
  );
}
