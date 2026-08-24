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
 * checkout/payment architecture (not assumed), and, as of Phase 4A, in
 * three real custom WooCommerce order statuses registered by
 * wordpress/custom-plugin/orders/class-cofeo-order-status.php — see
 * that file's own docblock for why only these three are new statuses
 * (PREPARING/SHIPPED/OUT_FOR_DELIVERY, the ones WooCommerce genuinely
 * has no native equivalent for) while NEW/CONFIRMED/DELIVERED/
 * CANCELLED continue mapping onto WooCommerce's own native statuses,
 * only *relabeled* for the admin dropdown, never re-registered:
 *
 * - `pending`: order created, not yet actively handled → NEW.
 * - `on-hold`: set by the bank-transfer gateway while awaiting manual
 *   verification (wordpress/custom-plugin/checkout/
 *   class-cofeo-bank-transfer-gateway.php) — the order has been
 *   *received* but is not yet confirmed as a real, payable order, so
 *   this is customer-facing NEW, not CONFIRMED.
 * - `processing`: WooCommerce's default post-payment status, and what
 *   COD orders land on immediately (no gateway-side status override) —
 *   the order is confirmed and being acted on → CONFIRMED.
 * - `cofeo-preparing` / `cofeo-shipped` / `cofeo-outfordel`: the real
 *   WooCommerce statuses for these three steps (Phase 4A) — a direct
 *   1:1 mapping, no meta lookup needed. `resolveCofeoStatus` below
 *   still checks the legacy `_cofeo_order_status` meta as a fallback,
 *   purely for orders created before this phase that were never
 *   migrated (see the `wp cofeo-order-status migrate` command).
 * - `completed`: fulfillment finished → DELIVERED.
 * - `cancelled` / `failed`: neither culminates in a delivered order →
 *   CANCELLED.
 * - `refunded`: also mapped to CANCELLED, unchanged from before Phase
 *   4A — flagged there as a decision that may warrant a dedicated
 *   COFEO status of its own rather than being silently folded into
 *   CANCELLED (refunded implies the order *was* paid and fulfilled to
 *   some degree before money moved back, a different business meaning
 *   than "never happened"). Kept as the existing, safe, unchanged
 *   behavior pending that explicit decision — see the Phase 4A report.
 * - Anything else (custom/unknown plugin status, `trash`,
 *   `checkout-draft`, ...): NEW — the least presumptuous fallback;
 *   claiming further progress on a status we don't recognize would
 *   risk exactly the "contradictory state" the mapping must avoid.
 */
export function mapWooCommerceStatusToCofeoStatus(wcStatus: string): CofeoStatusKey {
  const normalized = wcStatus.replace(/^wc-/, "");
  switch (normalized) {
    case "pending":
    case "on-hold":
      return "NEW";
    case "processing":
      return "CONFIRMED";
    case "cofeo-preparing":
      return "PREPARING";
    case "cofeo-shipped":
      return "SHIPPED";
    case "cofeo-outfordel":
      return "OUT_FOR_DELIVERY";
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
 * LEGACY fallback only, as of Phase 4A. Before that phase,
 * PREPARING/SHIPPED/OUT_FOR_DELIVERY had no real WooCommerce status of
 * their own — they lived entirely in this namespaced order meta field
 * while the real WC status stayed `processing` (matching this plugin's
 * `_cofeo_*` meta convention, see class-cofeo-shipping-product-promo.php).
 * WooCommerce stayed the only order record — this was metadata *on*
 * that record, never a second one.
 *
 * Phase 4A registered real `cofeo-preparing`/`cofeo-shipped`/
 * `cofeo-outfordel` WooCommerce statuses (wordpress/custom-plugin/
 * orders/class-cofeo-order-status.php) and stopped writing this meta
 * going forward (lib/woocommerce/order-status-mutation.ts now writes
 * the real status directly for every non-NEW target) — the resolver
 * below now exists purely to keep historical, un-migrated orders
 * readable (see the `wp cofeo-order-status migrate` command for moving
 * them onto the real status instead). The meta value is trusted only
 * when it's a real refinement of the WC status, never a contradiction
 * of it: it must (a) be one of the PREPARING/SHIPPED/OUT_FOR_DELIVERY
 * sub-states, and (b) only apply while the WC-status-derived base is
 * CONFIRMED — a stray/stale meta value left over from before a
 * cancellation, for instance, can never override a WC status that has
 * since moved to DELIVERED or CANCELLED.
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
