import { wcRestFetch } from "@/lib/woocommerce/rest-client";

/**
 * Phase 4E — reads the COFEO loyalty ledger. The ledger itself lives in
 * a dedicated WordPress table with a real database UNIQUE constraint
 * (wordpress/custom-plugin/loyalty/class-cofeo-loyalty-schema.php) —
 * the one piece of this feature with true concurrency guarantees, and
 * the sole source of truth. This file never talks to that table
 * directly (there is no REST surface for it, and none is needed): it
 * reads the same denormalized projection
 * wordpress/custom-plugin/loyalty/class-cofeo-loyalty.php already
 * writes onto the WooCommerce customer record as meta, via the exact
 * `/wc/v3/customers/{id}` call lib/auth/session.ts's
 * `fetchLiveSessionGeneration` already makes — no new REST endpoint,
 * no new authentication mechanism. If that projection is ever stale
 * (a write raced or failed), the ledger table itself is still correct;
 * this file simply can't see past the projection, a documented
 * limitation, not a correctness risk to the ledger.
 */

export const LOYALTY_TRANSACTION_TYPES = ["EARN", "REVERSAL"] as const;
export type LoyaltyTransactionType = (typeof LOYALTY_TRANSACTION_TYPES)[number];

export const LOYALTY_REASONS = ["ORDER_DELIVERED", "STATUS_CORRECTED"] as const;
export type LoyaltyReason = (typeof LOYALTY_REASONS)[number];

export type LoyaltyTransaction = {
  type: LoyaltyTransactionType;
  points: number;
  orderId: number;
  episode: number;
  reason: LoyaltyReason;
  /** ISO-8601, as recorded by the PHP side (`gmdate('c')`). */
  createdAt: string;
};

export type LoyaltySummary = {
  balance: number;
  totalEarned: number;
  totalReversed: number;
  transactions: LoyaltyTransaction[];
};

const EMPTY_SUMMARY: LoyaltySummary = { balance: 0, totalEarned: 0, totalReversed: 0, transactions: [] };

/**
 * Deliberately NOT underscore-prefixed — see
 * wordpress/custom-plugin/loyalty/class-cofeo-loyalty.php's matching
 * constants for why: WooCommerce's Customers REST controller silently
 * omits underscore-prefixed ("protected") meta keys from
 * `/wc/v3/customers/{id}`, unlike its Orders controller. Must stay in
 * sync with that file's constants by hand, the same convention this
 * codebase already uses for every other PHP/TypeScript key pair (e.g.
 * `STATUS_HISTORY_EVENT_META_KEY_PREFIX`).
 */
const CUSTOMER_META_TXN_PREFIX = "cofeo_loyalty_txn_";
const CUSTOMER_META_BALANCE_KEY = "cofeo_loyalty_balance";
const CUSTOMER_META_TOTAL_EARNED_KEY = "cofeo_loyalty_total_earned";
const CUSTOMER_META_TOTAL_REVERSED_KEY = "cofeo_loyalty_total_reversed";

const ORDER_META_TXN_PREFIX = "_cofeo_loyalty_txn_";

type WcMetaEntry = { key: string; value: unknown };
type WcCustomerShape = { meta_data?: WcMetaEntry[] };
type WcOrderShape = { meta_data?: WcMetaEntry[] };

function isLoyaltyTransactionType(value: unknown): value is LoyaltyTransactionType {
  return typeof value === "string" && (LOYALTY_TRANSACTION_TYPES as readonly string[]).includes(value);
}

function isLoyaltyReason(value: unknown): value is LoyaltyReason {
  return typeof value === "string" && (LOYALTY_REASONS as readonly string[]).includes(value);
}

/**
 * Validates and narrows one raw candidate object down to exactly the
 * known-safe fields shared by both storage shapes — mirrors
 * lib/woocommerce/order-status.ts's `parseStatusHistoryEventCandidate`
 * exactly: only these fields are ever copied out, regardless of what
 * else the raw meta value contains, and malformed input degrades to
 * `null` rather than throwing (a customer's loyalty page must never
 * break because of a parsing problem). `orderId` is deliberately NOT
 * validated here: the customer-meta projection
 * (project_customer_ledger() in class-cofeo-loyalty.php) includes it
 * in the JSON since one customer's ledger spans many orders, but the
 * order-meta projection (project_order_transactions()) omits it as
 * redundant — the order it's stored on already IS the order id. Each
 * parse* wrapper below attaches the correct `orderId` for its own
 * context instead.
 */
function parseLoyaltyTransactionCandidate(
  candidate: unknown,
): Omit<LoyaltyTransaction, "orderId"> | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const c = candidate as Record<string, unknown>;

  if (!isLoyaltyTransactionType(c.type)) return null;
  if (typeof c.points !== "number" || !Number.isFinite(c.points) || c.points < 0) return null;
  if (typeof c.episode !== "number" || !Number.isInteger(c.episode) || c.episode <= 0) return null;
  if (!isLoyaltyReason(c.reason)) return null;
  if (typeof c.createdAt !== "string" || c.createdAt === "") return null;

  return { type: c.type, points: c.points, episode: c.episode, reason: c.reason, createdAt: c.createdAt };
}

/** For the customer-meta projection, where `orderId` is part of the
 *  stored JSON itself (validated here, never trusted implicitly). */
function parseCustomerLoyaltyTransaction(raw: unknown): LoyaltyTransaction | null {
  if (typeof raw !== "string" || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const base = parseLoyaltyTransactionCandidate(parsed);
  if (!base) return null;

  const orderId = (parsed as Record<string, unknown>).orderId;
  if (typeof orderId !== "number" || !Number.isInteger(orderId) || orderId <= 0) return null;

  return { ...base, orderId };
}

/** For the order-meta projection, where `orderId` is supplied by the
 *  caller (the order this meta entry was read from) rather than
 *  parsed from the JSON — see this function's own docblock above. */
function parseOrderLoyaltyTransaction(raw: unknown, orderId: number): LoyaltyTransaction | null {
  if (typeof raw !== "string" || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const base = parseLoyaltyTransactionCandidate(parsed);
  return base ? { ...base, orderId } : null;
}

function parseNonNegativeInt(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.trunc(raw);
  if (typeof raw === "string" && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }
  return 0;
}

function sortTransactions(transactions: LoyaltyTransaction[]): LoyaltyTransaction[] {
  return [...transactions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/**
 * The customer's own loyalty summary — the ONLY function customer-
 * facing code should call. `wooCustomerId` must come from the caller's
 * own verified session (`session.wooCustomerId`), exactly the same
 * rule `getOrdersByCustomerId` already documents; never a value the
 * browser supplies. A guest identifier (`<= 0`) returns the empty
 * summary without any network call — guests never earn points (see
 * class-cofeo-loyalty.php), so there is nothing to fetch.
 */
export async function getLoyaltySummaryForCustomer(wooCustomerId: number): Promise<LoyaltySummary> {
  if (!Number.isInteger(wooCustomerId) || wooCustomerId <= 0) return EMPTY_SUMMARY;

  let raw: WcCustomerShape;
  try {
    raw = await wcRestFetch<WcCustomerShape>(`/customers/${wooCustomerId}`);
  } catch {
    return EMPTY_SUMMARY;
  }
  if (!raw) return EMPTY_SUMMARY;

  const metaData = raw.meta_data ?? [];
  const balance = parseNonNegativeInt(metaData.find((m) => m.key === CUSTOMER_META_BALANCE_KEY)?.value);
  const totalEarned = parseNonNegativeInt(metaData.find((m) => m.key === CUSTOMER_META_TOTAL_EARNED_KEY)?.value);
  const totalReversed = parseNonNegativeInt(metaData.find((m) => m.key === CUSTOMER_META_TOTAL_REVERSED_KEY)?.value);

  const transactions: LoyaltyTransaction[] = [];
  for (const entry of metaData) {
    if (!entry.key.startsWith(CUSTOMER_META_TXN_PREFIX)) continue;
    const txn = parseCustomerLoyaltyTransaction(entry.value);
    if (txn) transactions.push(txn);
  }

  return { balance, totalEarned, totalReversed, transactions: sortTransactions(transactions) };
}

/**
 * This one order's own loyalty transactions — for the admin order-
 * detail page (Phase 4D's `/admin/orders/[id]`). Deliberately a fully
 * separate fetch from lib/woocommerce/order.ts's `getOrderById`, never
 * threading a loyalty field through `OrderDetails`: keeps the loyalty
 * system independent, as required, from the already-verified order
 * read/mutation architecture — nothing here can affect, or be affected
 * by, a change to how `OrderDetails` is shaped. Ordinarily 0, 1, or 2
 * entries; more only after multiple earn/reverse episodes.
 */
export async function getLoyaltyTransactionsForOrder(orderId: number): Promise<LoyaltyTransaction[]> {
  if (!Number.isInteger(orderId) || orderId <= 0) return [];

  let raw: WcOrderShape;
  try {
    raw = await wcRestFetch<WcOrderShape>(`/orders/${orderId}`);
  } catch {
    return [];
  }
  if (!raw) return [];

  const transactions: LoyaltyTransaction[] = [];
  for (const entry of raw.meta_data ?? []) {
    if (!entry.key.startsWith(ORDER_META_TXN_PREFIX)) continue;
    const txn = parseOrderLoyaltyTransaction(entry.value, orderId);
    if (txn) transactions.push(txn);
  }

  return sortTransactions(transactions);
}
