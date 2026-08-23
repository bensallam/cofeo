import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";
import { getOrderTimeline, type CofeoStatusKey } from "@/lib/woocommerce/order-status";

type OrderStatusTimelineProps = {
  status: CofeoStatusKey;
  className?: string;
};

/**
 * The step-by-step order lifecycle view — ✓ done / ● active / ○
 * upcoming, generated entirely from `getOrderTimeline` (never
 * hard-coded per screen). Built once here so it can be reused as-is by
 * Order Confirmation today and a future /account order list/detail
 * view, without redesigning anything.
 *
 * A cancelled order renders as a single terminal notice instead of a
 * partial ladder — see `getOrderTimeline`'s own doc comment for why.
 */
export function OrderStatusTimeline({ status, className }: OrderStatusTimelineProps) {
  const t = useTranslations("Checkout.orderStatus");
  const timeline = getOrderTimeline(status);

  if (timeline.cancelled) {
    return (
      <div className={cn("flex items-center gap-3 rounded-(--radius-card) border border-error bg-error-surface p-4", className || null)}>
        <StepIcon state="cancelled" />
        <div className="flex flex-col gap-0.5">
          <span className="text-body-s font-medium text-error">{t("CANCELLED.label")}</span>
          <span className="text-caption text-text-secondary">{t("CANCELLED.description")}</span>
        </div>
      </div>
    );
  }

  return (
    <ol className={cn("flex flex-col", className || null)}>
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
            </div>
          </li>
        );
      })}
    </ol>
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
