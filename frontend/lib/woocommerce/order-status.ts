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

/**
 * Phase 4C — one append-only event recorded by
 * wordpress/custom-plugin/orders/class-cofeo-order-status.php's
 * `append_history_event()`. Deliberately carries no identity (no
 * admin/customer email, no user id, no IP, no session/notification
 * data) — only what the customer-facing timeline needs: which status,
 * what it moved from, when, and the coarse admin/system distinction.
 */
export type StatusHistoryEvent = {
  status: CofeoStatusKey;
  previousStatus: CofeoStatusKey | null;
  /** ISO-8601, as recorded by the PHP side (`gmdate('c')`). */
  timestamp: string;
  source: "admin" | "system";
};

/**
 * LEGACY — the original Phase 4C storage key (one JSON array of every
 * event). Superseded, before ever being committed, by the hardened
 * per-event storage below: a shared array meant every write was a
 * read-existing/modify/write-back cycle, a real lost-update race under
 * two genuinely concurrent status changes for the same order. No
 * longer written to by wordpress/custom-plugin/orders/class-cofeo-order-status.php
 * — kept read-only so any order that already accumulated history
 * under it (e.g. from local testing during that earlier iteration)
 * doesn't lose it; see order.ts's reconstructStatusHistory(), which
 * merges this with the new per-event records rather than discarding
 * it. */
export const STATUS_HISTORY_META_KEY = "_cofeo_status_history";

/**
 * Prefix for the hardened, per-event storage — mirrors
 * `HISTORY_EVENT_META_KEY_PREFIX` in class-cofeo-order-status.php
 * exactly; kept in sync by hand, the same convention
 * `COFEO_STATUS_META_KEY` already uses for its own PHP-side
 * counterpart. Each real order meta key is this prefix plus a
 * microsecond-resolution sort prefix and a random suffix (see that
 * PHP method's own docblock); order.ts's reconstructStatusHistory()
 * is what turns the set of matching meta entries back into an
 * ordered `StatusHistoryEvent[]`.
 */
export const STATUS_HISTORY_EVENT_META_KEY_PREFIX = "_cofeo_status_event_";

function isCofeoStatusKeyValue(value: unknown): value is CofeoStatusKey {
  return typeof value === "string" && (COFEO_STATUS_KEYS as readonly string[]).includes(value);
}

/**
 * Validates and narrows one raw candidate object down to exactly the
 * four known-safe fields `StatusHistoryEvent` declares — shared by
 * both parsers below so the same strict rule applies identically to
 * the legacy whole-array format and the new per-event format. Returns
 * `null` (never throws) for anything that doesn't validate. This is
 * the one place responsible for making sure an unexpected/extra
 * property on a stored event (e.g. a hypothetical future `actorEmail`
 * some other code path mistakenly wrote) can never reach a caller:
 * only `status`/`previousStatus`/`timestamp`/`source` are ever copied
 * out, by construction, regardless of what else the raw object
 * contains.
 */
function parseStatusHistoryEventCandidate(candidate: unknown): StatusHistoryEvent | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const c = candidate as Record<string, unknown>;

  if (!isCofeoStatusKeyValue(c.status)) return null;
  if (typeof c.timestamp !== "string" || c.timestamp === "") return null;

  const previousStatus = isCofeoStatusKeyValue(c.previousStatus) ? c.previousStatus : null;
  const source = c.source === "admin" || c.source === "system" ? c.source : "system";

  return { status: c.status, previousStatus, timestamp: c.timestamp, source };
}

/**
 * Parses ONE event's raw JSON string — a single
 * `_cofeo_status_event_<id>` order-meta value, the hardened Phase 4C
 * storage format (one independent meta record per event, never a
 * shared array — see class-cofeo-order-status.php's
 * append_history_event()). Never throws: malformed JSON or a
 * malformed/incomplete object both degrade to `null`, dropped by
 * order.ts's reconstruction rather than breaking the page.
 */
export function parseStatusHistoryEvent(raw: unknown): StatusHistoryEvent | null {
  if (typeof raw !== "string" || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseStatusHistoryEventCandidate(parsed);
}

/**
 * Parses the LEGACY `_cofeo_status_history` whole-array blob — see
 * that constant's own docblock for why this format was superseded.
 * Never throws; malformed JSON, a non-array value, or individual
 * malformed entries all degrade to being silently dropped rather than
 * thrown — a customer's order page must never break because of a
 * history-parsing problem; worst case, they simply see no legacy
 * history for that order.
 */
export function parseStatusHistory(raw: unknown): StatusHistoryEvent[] {
  if (typeof raw !== "string" || raw === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const events: StatusHistoryEvent[] = [];
  for (const entry of parsed) {
    const event = parseStatusHistoryEventCandidate(entry);
    if (event) events.push(event);
  }
  return events;
}

export type TimelineStepWithTimestamp = TimelineStep & { timestamp: string | null };

/**
 * A recorded event whose status moved to an earlier position than the
 * one it came from — e.g. DELIVERED (position 6) corrected back to
 * PREPARING (position 3). Surfaced as its own distinct callout by the
 * UI, never woven into the forward ladder itself: the ladder's
 * done/active/upcoming states continue to reflect only the *current*
 * status (see getOrderTimelineWithHistory below), exactly as they did
 * before Phase 4C — a correction is additional context alongside that
 * ladder, not a change to how the ladder itself is computed.
 */
export type StatusCorrection = {
  from: CofeoStatusKey;
  to: CofeoStatusKey;
  /** `null` only if the correction is the very first recorded event
   *  for this order (no earlier occurrence of `from` was ever
   *  captured) — never fabricated. */
  fromTimestamp: string | null;
  toTimestamp: string;
};

export type OrderTimelineWithHistory =
  | { cancelled: false; steps: TimelineStepWithTimestamp[]; corrections: StatusCorrection[] }
  | { cancelled: true; timestamp: string | null };

/**
 * Extends `getOrderTimeline` with real recorded timestamps and
 * correction callouts, without changing what that function itself
 * computes: the ladder's done/active/upcoming states still come
 * entirely from the *current* `status`, exactly as before — current
 * WooCommerce status remains the source of truth for current state
 * (Phase 4C's own explicit requirement). History only adds read-only
 * context on top: a timestamp for each step that was actually
 * reached, and a separate list of corrections for any event that
 * moved backward. A step with no matching event in `history` gets
 * `timestamp: null` — never a fabricated date; this is the expected,
 * common case for any order created before Phase 4C shipped, or for
 * a step reached before this feature existed.
 */
export function getOrderTimelineWithHistory(
  status: CofeoStatusKey,
  history: readonly StatusHistoryEvent[] = [],
): OrderTimelineWithHistory {
  const base = getOrderTimeline(status);

  // The most recent recorded timestamp for each status — a step
  // reached more than once (e.g. re-confirmed after a correction)
  // shows its latest occurrence, matching what "currently done since"
  // should mean.
  const latestTimestampFor = new Map<CofeoStatusKey, string>();
  for (const event of history) {
    latestTimestampFor.set(event.status, event.timestamp);
  }

  if (base.cancelled) {
    return { cancelled: true, timestamp: latestTimestampFor.get("CANCELLED") ?? null };
  }

  const corrections: StatusCorrection[] = [];
  for (const event of history) {
    if (!event.previousStatus) continue;
    const fromPosition = COFEO_STATUS_DEFINITIONS[event.previousStatus].position;
    const toPosition = COFEO_STATUS_DEFINITIONS[event.status].position;
    if (fromPosition === null || toPosition === null) continue;
    if (toPosition < fromPosition) {
      corrections.push({
        from: event.previousStatus,
        to: event.status,
        fromTimestamp: latestTimestampFor.get(event.previousStatus) ?? null,
        toTimestamp: event.timestamp,
      });
    }
  }

  return {
    cancelled: false,
    // Deliberately never attached to an "upcoming" step: a status can
    // only be "upcoming" while also having a real recorded timestamp
    // when it was reached once, then corrected away from (e.g.
    // DELIVERED after a DELIVERED -> PREPARING correction) — showing
    // that date next to an empty "not yet reached" circle would read
    // as contradictory. That historical fact is what `corrections`
    // above surfaces instead, explicitly, as its own callout.
    steps: base.steps.map((step) => ({
      ...step,
      timestamp: step.state === "upcoming" ? null : (latestTimestampFor.get(step.key) ?? null),
    })),
    corrections,
  };
}
