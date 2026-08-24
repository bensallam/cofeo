import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/design/cn";
import {
  getOrderTimelineWithHistory,
  type CofeoStatusKey,
  type StatusHistoryEvent,
} from "@/lib/woocommerce/order-status";
import { formatOrderDate } from "@/lib/i18n/date";
import type { Locale } from "@/i18n/routing";

type OrderStatusTimelineProps = {
  status: CofeoStatusKey;
  /** Phase 4C — optional; omit for the exact pre-4C behavior (no
   *  timestamps, no correction callouts). See order.ts's
   *  `OrderDetails.statusHistory`. */
  history?: StatusHistoryEvent[];
  className?: string;
};

/**
 * The step-by-step order lifecycle view — ✓ done / ● active / ○
 * upcoming, generated entirely from `getOrderTimelineWithHistory`
 * (never hard-coded per screen). Built once here so it can be reused
 * as-is by Order Confirmation and /account order details, without
 * redesigning anything.
 *
 * Current WooCommerce status remains the only thing that decides
 * done/active/upcoming, exactly as before Phase 4C — `history` only
 * adds a timestamp under each reached step and, when a later event
 * moved status backward (an admin correction), a separate callout
 * beneath the ladder. It never marks an earlier-reached status like
 * DELIVERED as "active" again — the ladder always reflects the
 * *current* status only.
 *
 * A cancelled order renders as a single terminal notice instead of a
 * partial ladder — see `getOrderTimeline`'s own doc comment for why.
 */
export function OrderStatusTimeline({ status, history = [], className }: OrderStatusTimelineProps) {
  const t = useTranslations("Checkout.orderStatus");
  const tCorrection = useTranslations("OrderTimeline");
  const locale = useLocale() as Locale;
  const timeline = getOrderTimelineWithHistory(status, history);

  if (timeline.cancelled) {
    return (
      <div className={cn("flex items-center gap-3 rounded-(--radius-card) border border-error bg-error-surface p-4", className || null)}>
        <StepIcon state="cancelled" />
        <div className="flex flex-col gap-0.5">
          <span className="text-body-s font-medium text-error">{t("CANCELLED.label")}</span>
          <span className="text-caption text-text-secondary">{t("CANCELLED.description")}</span>
          {timeline.timestamp && (
            <span className="text-caption text-text-muted">{formatOrderDate(timeline.timestamp, locale)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className || null)}>
      <ol className="flex flex-col">
        {timeline.steps.map((step, index) => {
          const isLast = index === timeline.steps.length - 1;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepIcon state={step.state} />
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-px flex-1 min-h-6",
                      step.state === "done" ? "bg-success" : "bg-border-strong",
                    )}
                  />
                )}
              </div>
              <div className={cn("flex flex-col gap-0.5", !isLast && "pb-4")}>
                <span
                  className={cn(
                    "text-body-s font-medium",
                    step.state === "upcoming" ? "text-text-muted" : "text-text-primary",
                  )}
                >
                  {t(`${step.key}.label`)}
                </span>
                <span className="text-caption text-text-secondary">{t(`${step.key}.description`)}</span>
                {step.timestamp && (
                  <span className="text-caption text-text-muted">{formatOrderDate(step.timestamp, locale)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {timeline.corrections.length > 0 && (
        <div className="flex flex-col gap-2 rounded-(--radius-card) border border-warning bg-warning-surface p-4">
          <span className="text-body-s font-medium text-warning">{tCorrection("correctionHeading")}</span>
          {timeline.corrections.map((correction, index) => (
            <span key={index} className="text-caption text-text-secondary">
              {tCorrection("correctionNotice", {
                fromLabel: t(`${correction.from}.label`),
                fromDate: correction.fromTimestamp ? formatOrderDate(correction.fromTimestamp, locale) : "—",
                toLabel: t(`${correction.to}.label`),
                toDate: formatOrderDate(correction.toTimestamp, locale),
              })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "upcoming" | "cancelled" }) {
  if (state === "done") {
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-[0.7rem] text-white"
      >
        ✓
      </span>
    );
  }
  if (state === "cancelled") {
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-error text-[0.7rem] text-white"
      >
        ✕
      </span>
    );
  }
  if (state === "active") {
    return (
      <span aria-hidden="true" className="relative flex size-6 shrink-0 items-center justify-center">
        <span className="absolute size-6 animate-ping rounded-full bg-bronze/40 motion-reduce:hidden" />
        <span className="relative size-3 rounded-full bg-bronze" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border-strong"
    />
  );
}
