import { useTranslations } from "next-intl";

/**
 * Pure presentation — no props, no state, no data fetching. Content
 * comes entirely from the Checkout.trustSection translation namespace
 * (added specifically for this section, distinct from the payment
 * method labels shown elsewhere on the page). Monochrome inline SVGs,
 * same hand-rolled-icon convention already used for the payment-method
 * badges and the back-link chevron — no icon library dependency.
 */
export function TrustSection() {
  const t = useTranslations("Checkout.trustSection");

  const items = [
    { key: "fastDelivery", icon: <TruckIcon /> },
    { key: "cod", icon: <CashIcon /> },
    { key: "warranty", icon: <ShieldIcon /> },
    { key: "customerService", icon: <HeadsetIcon /> },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-(--radius-card) border border-border bg-bg px-4 py-6 text-center shadow-sm"
        >
          <span className="text-text-primary [&_svg]:size-6" aria-hidden="true">
            {item.icon}
          </span>
          <span className="text-body-s leading-tight font-semibold text-text-primary">
            {t(`${item.key}.title`)}
          </span>
          <span className="text-caption leading-snug text-text-muted">{t(`${item.key}.description`)}</span>
        </div>
      ))}
    </div>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 7h11v9H2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}

/** Banknote (paper-money) shape, not a money bag — requested explicitly. */
function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="6" width="20" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M6 9h.01M18 15h.01" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13v-1a8 8 0 0116 0v1" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.5" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 19v1a2 2 0 01-2 2h-4" />
    </svg>
  );
}
