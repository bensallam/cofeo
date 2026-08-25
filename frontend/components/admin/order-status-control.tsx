"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { updateOrderStatusAction } from "@/lib/actions/admin-order-actions";
import { COFEO_STATUS_KEYS, type CofeoStatusKey } from "@/lib/woocommerce/order-status";

type OrderStatusControlProps = {
  orderId: number;
  currentStatus: CofeoStatusKey;
};

/**
 * The one interactive piece of the admin order detail page — every
 * other status concept it touches (the enum, the labels, the actual
 * write) is reused, never reimplemented: `COFEO_STATUS_KEYS` is the
 * same list `getOrderTimeline()` iterates, the labels come from the
 * exact same `Checkout.orderStatus.<KEY>.label` catalog the customer
 * timeline reads, and the write itself goes through
 * `updateOrderStatusAction` — the same Phase 2 entry point this
 * codebase has had, and tested, since before this page existed.
 *
 * No client-side transition validation happens here — an ADMIN may
 * select any of the 7 statuses, forward or backward, matching what
 * `transitionOrderCofeoStatus` now accepts (Phase 4D) and what
 * wp-admin's own dropdown has allowed since the Phase 4A persistence
 * fix. The server action is still what actually decides whether the
 * request succeeds; this control only ever reflects that decision
 * back, never assumes it.
 *
 * On success, `router.refresh()` re-runs the server component this is
 * embedded in — the freshly re-fetched order (new current status, new
 * history event, new audit note, already written by the WooCommerce
 * hook by the time this resolves) is what the rest of the page
 * re-renders from, not any state this component keeps itself.
 */
export function OrderStatusControl({ orderId, currentStatus }: OrderStatusControlProps) {
  const t = useTranslations("Admin");
  const tStatus = useTranslations("Checkout.orderStatus");
  const router = useRouter();
  const [selected, setSelected] = useState<CofeoStatusKey>(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  function handleSubmit() {
    if (selected === currentStatus) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, selected);
      if (result.success) {
        setToast({ message: t("statusUpdateSuccess"), variant: "success" });
        router.refresh();
      } else {
        setToast({ message: t("statusUpdateError"), variant: "error" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label={t("changeStatusLabel")}
          value={selected}
          onChange={(event) => setSelected(event.target.value as CofeoStatusKey)}
          disabled={isPending}
          className="sm:min-w-56"
        >
          {COFEO_STATUS_KEYS.map((key) => (
            <option key={key} value={key}>
              {tStatus(`${key}.label`)}
            </option>
          ))}
        </Select>
        <Button onClick={handleSubmit} loading={isPending} disabled={selected === currentStatus}>
          {t("updateStatusCta")}
        </Button>
      </div>
      <Toast isVisible={toast !== null} message={toast?.message ?? ""} variant={toast?.variant} />
    </div>
  );
}
