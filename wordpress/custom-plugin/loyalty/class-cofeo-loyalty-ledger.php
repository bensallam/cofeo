<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Phase 4E — the one place that reads or writes the loyalty ledger
 * table. Every write here goes through $wpdb directly (the deliberate,
 * documented exception to this codebase's "prefer WooCommerce CRUD/meta
 * APIs" rule — see class-cofeo-loyalty-schema.php's own docblock for
 * why): this is what lets `record_earn()`/`record_reversal()` rely on
 * a real database UNIQUE constraint for concurrency safety, something
 * no WordPress/WooCommerce meta API can provide.
 *
 * Concurrency guarantee, precisely: both methods below compute a
 * candidate `episode` number from a plain SELECT, then attempt an
 * `INSERT IGNORE`. If two processes race — both reading the same prior
 * state and computing the same episode number — only one INSERT can
 * ever succeed: the table's UNIQUE KEY (order_id, episode, type)
 * rejects the second one at the database engine level, and MySQL's
 * IGNORE modifier turns that rejection into "0 rows affected" instead
 * of an error. `$wpdb->query()`'s return value (rows affected) is
 * exactly what each method below uses to tell a genuine insert apart
 * from a lost race — never a second SELECT, which would itself be
 * racy. This is a correctness guarantee from the schema itself, not
 * from timing, exactly the same standard Phase 4C's independent-event
 * history storage was held to.
 */
class Cofeo_Loyalty_Ledger {

	const TYPE_EARN     = 'EARN';
	const TYPE_REVERSAL = 'REVERSAL';

	const REASON_ORDER_DELIVERED  = 'ORDER_DELIVERED';
	const REASON_STATUS_CORRECTED = 'STATUS_CORRECTED';

	public static function table_name() {
		return Cofeo_Loyalty_Schema::table_name();
	}

	/**
	 * Records one EARN for `$order_id`, unless that order already has
	 * an active (un-reversed) EARN. Returns the points actually
	 * recorded on success, or `false` if this call did not write
	 * anything — either because another concurrent call already won
	 * the race for this exact episode, or because an earlier, still-
	 * active episode already exists for this order.
	 *
	 * `$points` must already be a positive integer — this method
	 * doesn't itself decide eligibility or amount (see
	 * class-cofeo-loyalty-rules.php and class-cofeo-loyalty.php's
	 * `handle_earn()`), it only guarantees that recording it happens
	 * at most once per episode.
	 */
	public static function record_earn( $order_id, $customer_id, $points ) {
		global $wpdb;

		if ( $points <= 0 ) {
			return false;
		}

		$table = self::table_name();
		$last  = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT episode, type FROM {$table} WHERE order_id = %d ORDER BY episode DESC, id DESC LIMIT 1",
				$order_id
			)
		);

		if ( $last && self::TYPE_EARN === strtoupper( $last->type ) ) {
			// Already has an active, un-reversed EARN for this order —
			// the ordinary "hook fired again for the same transition"
			// case, not a new earning episode. No-op, not an error.
			return false;
		}

		$episode = $last ? ( (int) $last->episode + 1 ) : 1;

		$rows_affected = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (customer_id, order_id, episode, type, points, reason, created_at) VALUES (%d, %d, %d, %s, %d, %s, %s)",
				$customer_id,
				$order_id,
				$episode,
				self::TYPE_EARN,
				$points,
				self::REASON_ORDER_DELIVERED,
				current_time( 'mysql', true )
			)
		);

		return ( 1 === $rows_affected ) ? $points : false;
	}

	/**
	 * Reverses the active EARN episode for `$order_id`, if one exists.
	 * The reversed amount always mirrors the original EARN row's own
	 * `points` value — never recalculated from the order's current
	 * state — so the ledger stays internally consistent even if the
	 * business rule or the order's contents change later. Returns the
	 * points reversed on success, or `false` for a no-op: no active
	 * EARN to reverse (§4 of the Phase 4E spec — reversal without a
	 * prior earn must never do anything, and never can make the
	 * balance negative, since it only ever moves an amount that was
	 * itself already earned).
	 */
	public static function record_reversal( $order_id ) {
		global $wpdb;

		$table = self::table_name();
		$last  = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT customer_id, episode, type, points FROM {$table} WHERE order_id = %d ORDER BY episode DESC, id DESC LIMIT 1",
				$order_id
			)
		);

		if ( ! $last || self::TYPE_EARN !== strtoupper( $last->type ) ) {
			return false;
		}

		$rows_affected = $wpdb->query(
			$wpdb->prepare(
				"INSERT IGNORE INTO {$table} (customer_id, order_id, episode, type, points, reason, created_at) VALUES (%d, %d, %d, %s, %d, %s, %s)",
				$last->customer_id,
				$order_id,
				$last->episode,
				self::TYPE_REVERSAL,
				$last->points,
				self::REASON_STATUS_CORRECTED,
				current_time( 'mysql', true )
			)
		);

		return ( 1 === $rows_affected ) ? (int) $last->points : false;
	}

	/**
	 * The ledger is the sole source of truth for a customer's balance
	 * (§7 of the Phase 4E spec) — always a fresh SUM over every row,
	 * never a running counter that could drift. Because a REVERSAL can
	 * only ever exist for an episode that already has a matching EARN
	 * of the same magnitude (see record_reversal() above), this
	 * difference cannot go negative through normal operation; no
	 * additional clamping is applied here, since doing so would hide a
	 * real data problem instead of surfacing it.
	 */
	public static function get_balance_for_customer( $customer_id ) {
		global $wpdb;
		$table = self::table_name();

		$earned = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COALESCE(SUM(points), 0) FROM {$table} WHERE customer_id = %d AND type = %s",
				$customer_id,
				self::TYPE_EARN
			)
		);
		$reversed = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COALESCE(SUM(points), 0) FROM {$table} WHERE customer_id = %d AND type = %s",
				$customer_id,
				self::TYPE_REVERSAL
			)
		);

		return array(
			'balance'       => $earned - $reversed,
			'totalEarned'   => $earned,
			'totalReversed' => $reversed,
		);
	}

	/** Every transaction for one customer, newest first — the
	 *  authoritative source class-cofeo-loyalty.php's
	 *  project_customer_ledger() reads from to refresh the customer's
	 *  meta-based read projection. */
	public static function get_ledger_for_customer( $customer_id ) {
		global $wpdb;
		$table = self::table_name();

		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, order_id, episode, type, points, reason, created_at FROM {$table} WHERE customer_id = %d ORDER BY created_at DESC, id DESC",
				$customer_id
			)
		);
	}

	/** Every transaction for one order (typically 0, 1, or 2 rows —
	 *  more only after multiple earn/reverse episodes), oldest first. */
	public static function get_ledger_for_order( $order_id ) {
		global $wpdb;
		$table = self::table_name();

		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, episode, type, points, reason, created_at FROM {$table} WHERE order_id = %d ORDER BY episode ASC, id ASC",
				$order_id
			)
		);
	}
}
