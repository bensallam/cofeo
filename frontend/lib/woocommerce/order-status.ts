/**
 * COFEO customer-facing order status — a typed layer over WooCommerce's
 * own order statuses, not a replacement for them. WooCommerce remains
 * the single source of truth; this module only translates its native
 * status (plus an optional refinement meta field, see
 * `resolveCofeoStatus`) into the 7-step lifecycle customers see.
 *
 * Naming matches the existing `ERROR_CODES` convention in
 * lib/errors/app-error.ts (UPPER_SNAKE_CASE string literals) — the
 * established pattern in this codebase for a stable typed enum that
 * also doubles as a lookup key into the i18n message catalogs
 * (`Checkout.orderStatus.<KEY>.label` / `.description`).
 */

export const COFEO_STATUS_KEYS = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type CofeoStatusKey = (typeof COFEO_STATUS_KEYS)[number];

type CofeoStatusDefinition = {
  key: CofeoStatusKey;
  /** 1-based position in the linear happy path. `null` for CANCELLED,
   *  which branches off the path rather than sitting on it. */
  position: number | null;
  terminal: boolean;
  allowedTransitions: readonly CofeoStatusKey[];
};

/**
 * The full state machine. Forward-only along the happy path; every
 * non-terminal state can also branch to CANCELLED (an order can be
 * cancelled at any point before delivery — see class-level doc).
 * DELIVERED and CANCELLED have no outgoing transitions.
 */
export const COFEO_STATUS_DEFINITIONS: Record<CofeoStatusKey, CofeoStatusDefinition> = {
  NEW: { key: "NEW", position: 1, terminal: false, allowedTransitions: ["CONFIRMED", "CANCELLED"] },
  CONFIRMED: {
    key: "CONFIRMED",
    position: 2,
    terminal: false,
    allowedTransitions: ["PREPARING", "CANCELLED"],
  },
  PREPARING: {
    key: "PREPARING",
    position: 3,
    terminal: false,
    allowedTransitions: ["SHIPPED", "CANCELLED"],
  },
  SHIPPED: {
    key: "SHIPPED",
    position: 4,
    terminal: false,
    allowedTransitions: ["OUT_FOR_DELIVERY", "CANCELLED"],
  },
  OUT_FOR_DELIVERY: {
    key: "OUT_FOR_DELIVERY",
    position: 5,
    terminal: false,
    allowedTransitions: ["DELIVERED", "CANCELLED"],
  },
  DELIVERED: { key: "DELIVERED", position: 6, terminal: true, allowedTransitions: [] },
  CANCELLED: { key: "CANCELLED", position: null, terminal: true, allowedTransitions: [] },
};

/** The six steps of the linear happy-path timeline, in order. Excludes
 *  CANCELLED, which the UI renders as a distinct terminal state rather
 *  than a step on this ladder (see `getOrderTimeline`). */
export const COFEO_TIMELINE_STEPS: readonly CofeoStatusKey[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export function getAllowedTransitions(from: CofeoStatusKey): readonly CofeoStatusKey[] {
  return COFEO_STATUS_DEFINITIONS[from].allowedTransitions;
}

/**
 * Server-side transition guard — the only place a status change should
 * ever be accepted from. Never trust a `from`/`to` pair supplied by a
 * client; this function is what an eventual admin mutation endpoint
 * (Phase 2+, once this app has an admin-authorization mechanism to
 * gate it with) must check before writing anything.
 */
export function canTransition(from: CofeoStatusKey, to: CofeoStatusKey): boolean {
  if (from === to) return false;
  return COFEO_STATUS_DEFINITIONS[from].allowedTransitions.includes(to);
}

export function isTerminalStatus(status: CofeoStatusKey): boolean {
  return COFEO_STATUS_DEFINITIONS[status].terminal;
}

/**
 * WooCommerce → COFEO mapping. Grounded in this store's actual
 * checkout/payment architecture (not assumed):
 *
 * - `pending`: order created, not yet actively handled → NEW.
 * - `on-hold`: set by the bank-transfer gateway while awaiting manual
 *   verification (wordpress/custom-plugin/checkout/
 *   class-cofeo-bank-transfer-gateway.php) — the order has been
 *   *received* but is not yet confirmed as a real, payable order, so
 *   this is customer-facing NEW, not CONFIRMED.
 * - `processing`: WooCommerce's default post-payment status, and what
 *   COD orders land on immediately (no gateway-side status override) —
 *   the order is confirmed and being acted on → CONFIRMED. WooCommerce
 *   has no native status for the finer PREPARING/SHIPPED/
 *   OUT_FOR_DELIVERY steps that also happen while the WC status is
 *   still `processing`; see `resolveCofeoStatus` for how those are
 *   layered on without inventing a second order status field.
 * - `completed`: fulfillment finished → DELIVERED.
 * - `cancelled` / `failed` / `refunded`: none of these culminate in a
 *   delivered order → CANCELLED. Deliberately not split into a
 *   separate REFUNDED state — Phase 1 exposes exactly the 7 statuses
 *   specified, and refunded/failed/cancelled are equally "this order
 *   is not happening" from the customer's point of view.
 * - Anything else (custom/unknown plugin status, `trash`, ...): NEW —
 *   the least presumptuous fallback; claiming further progress on a
 *   status we don't recognize would risk exactly the "contradictory
 *   state" the mapping must avoid.
 */
export function mapWooCommerceStatusToCofeoStatus(wcStatus: string): CofeoStatusKey {
  const normalized = wcStatus.replace(/^wc-/, "");
  switch (normalized) {
    case "pending":
    case "on-hold":
      return "NEW";
    case "processing":
      return "CONFIRMED";
    case "completed":
      return "DELIVERED";
    case "cancelled":
    case "failed":
    case "refunded":
      return "CANCELLED";
    default:
      return "NEW";
  }
}

/**
 * The smallest safe extension for the logistics states WooCommerce
 * itself has no status for (PREPARING/SHIPPED/OUT_FOR_DELIVERY, all of
 * which happen while the WC order is still `processing`): a single
 * namespaced order meta field, `_cofeo_order_status`, matching this
 * plugin's own existing `_cofeo_*` meta convention (see
 * class-cofeo-shipping-product-promo.php). WooCommerce stays the only
 * order record — this is metadata *on* that record, never a second
 * one.
 *
 * The meta value is trusted only when it's a real refinement of the WC
 * status, never a contradiction of it: it must (a) be one of the
 * PREPARING/SHIPPED/OUT_FOR_DELIVERY sub-states, and (b) only apply
 * while the WC-status-derived base is CONFIRMED — a stray/stale meta
 * value left over from before a cancellation, for instance, can never
 * override a WC status that has since moved to DELIVERED or CANCELLED.
 * No admin UI writes this meta yet (Phase 1 is read-only); this
 * resolver is what a future Phase 2+ mutation would target.
 */
const COFEO_STATUS_META_KEY = "_cofeo_order_status";

const REFINEMENT_STATUSES: ReadonlySet<CofeoStatusKey> = new Set(["PREPARING", "SHIPPED", "OUT_FOR_DELIVERY"]);

export function resolveCofeoStatus(wcStatus: string, metaStatus?: string | null): CofeoStatusKey {
  const base = mapWooCommerceStatusToCofeoStatus(wcStatus);
  if (base !== "CONFIRMED" || !metaStatus) return base;

  const candidate = metaStatus as CofeoStatusKey;
  return REFINEMENT_STATUSES.has(candidate) ? candidate : base;
}

export { COFEO_STATUS_META_KEY };

export type TimelineStepState = "done" | "active" | "upcoming";

export type TimelineStep = {
  key: CofeoStatusKey;
  state: TimelineStepState;
};

export type OrderTimeline =
  | { cancelled: false; steps: TimelineStep[] }
  | { cancelled: true };

/**
 * Builds the reusable timeline shape — done/active/upcoming steps
 * derived purely from the current status, nothing hard-coded. Meant to
 * back the confirmation page today and, unchanged, a future /account
 * order list/detail view (see `components/checkout/
 * order-status-timeline.tsx`, the component that renders this).
 *
 * A cancelled order isn't representable as partial progress along the
 * happy-path ladder — WooCommerce's own cancelled/failed/refunded
 * statuses don't tell us how far preparation got — so it's returned as
 * a distinct shape instead of guessing which steps to mark done.
 */
export function getOrderTimeline(status: CofeoStatusKey): OrderTimeline {
  if (status === "CANCELLED") return { cancelled: true };

  const currentPosition = COFEO_STATUS_DEFINITIONS[status].position ?? 0;
  const currentIsTerminal = isTerminalStatus(status);
  const steps: TimelineStep[] = COFEO_TIMELINE_STEPS.map((key) => {
    const position = COFEO_STATUS_DEFINITIONS[key].position ?? 0;
    // DELIVERED is both the current status and the finished ladder —
    // once reached it renders as done (✓), not active/in-progress,
    // since there's nothing left in progress.
    const state: TimelineStepState =
      position < currentPosition || (position === currentPosition && currentIsTerminal)
        ? "done"
        : position === currentPosition
          ? "active"
          : "upcoming";
    return { key, state };
  });

  return { cancelled: false, steps };
}
