<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Unifies WooCommerce's own order status with the COFEO customer
 * lifecycle (Phase 4A). WooCommerce remains the single, authoritative
 * status field for every state — this module:
 *
 * (a) registers the three logistics statuses WooCommerce has no native
 *     equivalent for (preparing/shipped/out-for-delivery — the ONLY
 *     new custom statuses this introduces). NEW/CONFIRMED/DELIVERED/
 *     CANCELLED continue mapping onto WooCommerce's own native
 *     pending|on-hold / processing / completed / cancelled — those are
 *     only ever *relabeled* for the admin dropdown
 *     (filter_order_statuses()), never re-registered as new statuses,
 *     because they're already correctly wired into WooCommerce's own
 *     stock/payment/reporting internals and there is no safe reason to
 *     touch that;
 *
 * (b) synchronizes COFEO's normalized status one way only, from
 *     whatever real WooCommerce status the order is now in
 *     (map_to_cofeo(), the same mapping lib/woocommerce/order-status.ts's
 *     mapWooCommerceStatusToCofeoStatus() mirrors on the read side).
 *     This hook NEVER writes an order status back to WooCommerce and
 *     NEVER rejects/reverts a change — a manually authorized WooCommerce
 *     admin correcting an order (including a "reverse" correction, e.g.
 *     DELIVERED → PREPARING because the admin made a mistake) is
 *     authoritative and must persist exactly as selected. WooCommerce
 *     admin is intentionally NOT held to the linear
 *     NEW→CONFIRMED→…→DELIVERED happy-path graph — that graph is
 *     enforced only where a transition is requested through COFEO's own
 *     app-initiated mutation path (lib/woocommerce/order-status-mutation.ts's
 *     canTransition() check, which runs *before* any WooCommerce write
 *     and therefore never reaches this hook for a rejected transition
 *     in the first place). Two different trust levels, two different
 *     places the rule applies — this hook is downstream of both and
 *     must not re-litigate a decision a human admin already made;
 *
 * (c) writes the one audit order note per change. This is now the
 *     single authoritative place that happens: the Next.js mutation
 *     layer (lib/woocommerce/order-status-mutation.ts) no longer
 *     writes its own note, specifically to avoid a duplicate when a
 *     COFEO-initiated change fires this same hook.
 *
 * (d) records one event to a customer-facing status-history log
 *     (Phase 4C) — separate from both (b) and (c), containing no
 *     admin identity, read by lib/woocommerce/order.ts's mapOrder()
 *     in the exact same order GET call the customer account pages
 *     already make (no extra network request). This is the only new
 *     behavior Phase 4C adds to this file; nothing about (a)-(c), or
 *     the persistence guarantee point (b) describes, changes.
 *
 *     Hardened storage (see append_history_event()): each event is
 *     its own independent order-meta record under a globally-unique
 *     key, never a single shared JSON array. The original Phase 4C
 *     design stored the whole history as one blob under
 *     LEGACY_HISTORY_META_KEY, which made every append a
 *     read-existing-blob/modify/write-back cycle — a genuine
 *     lost-update race under two truly concurrent writes for the same
 *     order. That key is now read-only (kept solely so nothing
 *     already recorded under it is silently discarded — see
 *     lib/woocommerce/order.ts's reconstructStatusHistory()) and is
 *     never written to again.
 *
 * Uses only WooCommerce's own CRUD API ($order->set_status()/
 * update_status()/save(), wc_get_order(), wc_get_orders()) — never a
 * direct database write — so this is correct under both classic
 * post-based storage and HPOS (verified enabled on this install).
 */
class Cofeo_Order_Status {

	/** Legacy meta key from before this phase — PREPARING/SHIPPED/
	 *  OUT_FOR_DELIVERY used to live only here while the real WC status
	 *  stayed `processing`. No longer written going forward (see
	 *  order-status-mutation.ts); kept readable for backward
	 *  compatibility with historical orders and as the migration
	 *  command's source (class-cofeo-order-status-cli.php). */
	const LEGACY_META_KEY = '_cofeo_order_status';

	/**
	 * Phase 4C (hardened storage): prefix for the per-event meta keys
	 * status-history entries are stored under — one order-meta record
	 * per real COFEO status change, each under its own globally-unique
	 * key (see append_history_event()), never a shared JSON array.
	 * Each record's *value* is a JSON-encoded
	 * `{status, previousStatus, timestamp, source}` object. Deliberately
	 * carries NO identity (no admin email, no user id, no IP, no
	 * session data) — only the coarse `source` category. Written
	 * alongside, never instead of, the existing audit note below; this
	 * is a pure additive record and never writes an order's `status`
	 * field itself, so it cannot interact with the persistence fix in
	 * `on_status_changed()` in any way.
	 *
	 * Why per-event keys instead of one array: WordPress/WooCommerce
	 * order meta has no atomic "append to array" primitive — updating
	 * one shared value is always read-existing/modify/write-back, and
	 * two genuinely concurrent writes for the same order can race on
	 * that read, with the second write's save silently clobbering the
	 * first's already-appended entry. Giving every event its own
	 * never-before-used key turns each write into a plain, independent
	 * INSERT — WC_Data::add_meta_data() with a fresh key adds a new row
	 * at save time, never reading or depending on any other meta row on
	 * the order. Two inserts under two different unique keys cannot
	 * collide at the database level regardless of timing, so this is
	 * safe by construction, not by getting lucky with request timing.
	 */
	const HISTORY_EVENT_META_KEY_PREFIX = '_cofeo_status_event_';

	/**
	 * LEGACY — the original Phase 4C storage key, one JSON array of all
	 * events. Superseded by HISTORY_EVENT_META_KEY_PREFIX above before
	 * ever being committed, for exactly the lost-update race described
	 * there. No longer written to. Kept only so any order that already
	 * has data under this key (e.g. from local testing during that
	 * earlier iteration) keeps showing it — see
	 * lib/woocommerce/order.ts's reconstructStatusHistory(), which
	 * merges this legacy blob with the new per-event records rather
	 * than discarding it.
	 */
	const LEGACY_HISTORY_META_KEY = '_cofeo_status_history';

	public static function register_statuses() {
		$definitions = array(
			'wc-cofeo-preparing' => __( 'En préparation', 'cofeo' ),
			'wc-cofeo-shipped'   => __( 'Expédiée', 'cofeo' ),
			'wc-cofeo-outfordel' => __( 'En cours de livraison', 'cofeo' ),
		);

		foreach ( $definitions as $slug => $label ) {
			register_post_status(
				$slug,
				array(
					'label'                     => $label,
					'public'                    => true,
					'exclude_from_search'       => false,
					'show_in_admin_all_list'    => true,
					'show_in_admin_status_list' => true,
					/* translators: %s: number of orders in this status */
					'label_count'               => _n_noop( $label . ' <span class="count">(%s)</span>', $label . ' <span class="count">(%s)</span>', 'cofeo' ),
				)
			);
		}
	}

	/**
	 * Rebuilds the status list WooCommerce's admin dropdown, status
	 * filter tabs, and REST API status enum all read from
	 * (`wc_get_order_statuses()`) — in the exact order Phase 4A Section
	 * 5 specifies, which a plain associative-array filter callback
	 * gives for free (PHP arrays preserve insertion order; WooCommerce
	 * iterates this array as-is, never re-sorting it).
	 *
	 * `wc-on-hold` is deliberately NOT relabeled to "Commande reçue"
	 * even though it also maps to COFEO's NEW on the read side — it's
	 * the bank-transfer gateway's own payment-verification state (see
	 * class-cofeo-bank-transfer-gateway.php), a genuinely distinct
	 * operational signal the admin needs to see as itself, not blurred
	 * into the general "received" label. It's spliced in right after
	 * `wc-pending` with its own native WooCommerce label untouched.
	 *
	 * Anything neither relabeled nor a new COFEO status (refunded,
	 * failed, checkout-draft, ...) is preserved unchanged and appended
	 * at the end — never silently dropped.
	 */
	public static function filter_order_statuses( $statuses ) {
		$relabel = array(
			'wc-pending'         => __( 'Commande reçue', 'cofeo' ),
			'wc-processing'      => __( 'Commande confirmée', 'cofeo' ),
			'wc-cofeo-preparing' => __( 'En préparation', 'cofeo' ),
			'wc-cofeo-shipped'   => __( 'Expédiée', 'cofeo' ),
			'wc-cofeo-outfordel' => __( 'En cours de livraison', 'cofeo' ),
			'wc-completed'       => __( 'Livrée', 'cofeo' ),
			'wc-cancelled'       => __( 'Annulée', 'cofeo' ),
		);

		$ordered = array();
		foreach ( $relabel as $slug => $label ) {
			$ordered[ $slug ] = $label;
			if ( 'wc-pending' === $slug && isset( $statuses['wc-on-hold'] ) ) {
				$ordered['wc-on-hold'] = $statuses['wc-on-hold'];
			}
		}

		foreach ( $statuses as $slug => $label ) {
			if ( ! isset( $ordered[ $slug ] ) ) {
				$ordered[ $slug ] = $label;
			}
		}

		return $ordered;
	}

	/**
	 * Mirrors `mapWooCommerceStatusToCofeoStatus()` in
	 * lib/woocommerce/order-status.ts, with one deliberate difference:
	 * this returns `null` (rather than falling back to NEW) for
	 * anything unrecognized, because its caller uses `null` to mean
	 * "not part of the COFEO model, skip validation entirely" — WordPress
	 * housekeeping statuses like `trash`, `auto-draft`, and
	 * `checkout-draft` must never be checked against the COFEO
	 * transition graph, or ordinary admin actions (deleting a test
	 * order, an in-progress Store API checkout draft) would be wrongly
	 * rejected/reverted.
	 */
	private static function map_to_cofeo( $status ) {
		$status = preg_replace( '/^wc-/', '', (string) $status );
		switch ( $status ) {
			case 'pending':
			case 'on-hold':
				return 'NEW';
			case 'processing':
				return 'CONFIRMED';
			case 'cofeo-preparing':
				return 'PREPARING';
			case 'cofeo-shipped':
				return 'SHIPPED';
			case 'cofeo-outfordel':
				return 'OUT_FOR_DELIVERY';
			case 'completed':
				return 'DELIVERED';
			case 'cancelled':
			case 'failed':
			case 'refunded':
				return 'CANCELLED';
			default:
				return null;
		}
	}

	/**
	 * Fires for EVERY WooCommerce order status change, from any origin.
	 * This is a pure read-derived sync: it writes an audit note
	 * describing the COFEO-normalized transition, and nothing else —
	 * it never calls `set_status()`/`update_status()` itself, so a
	 * self-triggered re-entry into this same hook is not something that
	 * can happen. WooCommerce's own status is never second-guessed here
	 * (see the class docblock, point (b)); an admin's manual change,
	 * forward or backward, terminal or not, always persists exactly as
	 * selected. A change that doesn't move between distinct COFEO
	 * states at all (e.g. pending → on-hold, both NEW) still gets one
	 * audit note, same as before.
	 */
	public static function on_status_changed( $order_id, $old_status, $new_status, $order ) {
		$old_cofeo = self::map_to_cofeo( $old_status );
		$new_cofeo = self::map_to_cofeo( $new_status );

		if ( null === $old_cofeo || null === $new_cofeo ) {
			return;
		}

		self::append_history_event( $order_id, $old_cofeo, $new_cofeo );
		self::write_note( $order, $old_cofeo, $new_cofeo );
	}

	/**
	 * Phase 4C (hardened): records one immutable event as its own
	 * independent order-meta record — never overwrites or reorders
	 * existing events, and never reads or depends on any of them
	 * either. Even a "reverse" correction (e.g. DELIVERED -> PREPARING)
	 * is recorded as a brand new record alongside the DELIVERED one,
	 * never a rewrite of it; the customer-facing timeline
	 * (lib/woocommerce/order-status.ts's getOrderTimelineWithHistory(),
	 * fed by order.ts's reconstructStatusHistory()) is what turns "a
	 * later event moved backward" into a visible correction notice, not
	 * this method.
	 *
	 * Concurrency safety, precisely: `$event_key` is constructed to be
	 * globally unique (a microsecond-resolution, fixed-width timestamp
	 * plus random bytes — see the inline comment below), so
	 * `add_meta_data()` here always adds a *new* meta row, never
	 * updates an existing one. WC_Data::save_meta_data() persists only
	 * the rows this specific in-memory `$order` object knows about
	 * (loaded fresh a line above); a concurrent request's own
	 * independent call to this same method, for the same order, is
	 * writing under an entirely different key and is invisible to —
	 * and unaffected by — this one. Two INSERTs under two different
	 * unique keys cannot collide at the database level no matter how
	 * their timing overlaps, under HPOS or legacy postmeta storage
	 * alike. This is a correctness guarantee from the storage shape
	 * itself, not something that depends on how quickly one request
	 * beats another.
	 *
	 * Uses `save_meta_data()` rather than the broader `save()`
	 * deliberately: it persists only the new meta row, without
	 * re-triggering order-level save hooks (emails, stock, reporting,
	 * ...) that a full `save()` would fire for no reason here, since
	 * nothing about the order's status/line items/totals changed.
	 */
	private static function append_history_event( $order_id, $old_cofeo, $new_cofeo ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		// Fixed-width (20-char), zero-padded, microsecond-resolution
		// timestamp so plain string comparison of this prefix always
		// matches true chronological order — this is what
		// order.ts's reconstructStatusHistory() sorts on to break ties
		// between two events recorded within the same rendered second.
		// The random suffix only guarantees key uniqueness even in the
		// astronomically unlikely case two events for the same order
		// are generated at the exact same microtime by two different
		// processes; it plays no role in ordering.
		$sort_prefix = str_pad( str_replace( '.', '', sprintf( '%020.6f', microtime( true ) ) ), 20, '0', STR_PAD_LEFT );
		$event_key   = self::HISTORY_EVENT_META_KEY_PREFIX . $sort_prefix . '_' . bin2hex( random_bytes( 4 ) );

		$event = array(
			'status'         => $new_cofeo,
			'previousStatus' => $old_cofeo,
			'timestamp'      => gmdate( 'c' ),
			'source'         => self::determine_history_source(),
		);

		$order->add_meta_data( $event_key, wp_json_encode( $event ), true );
		$order->save_meta_data();
	}

	/**
	 * Coarse-only classification — never the identity itself. A change
	 * made by a real logged-in WordPress user (wp-admin) or via COFEO's
	 * own authenticated mutation layer (`X-Cofeo-Actor` present, see
	 * write_note()'s own docblock) is "admin"; anything else (a
	 * checkout gateway auto-transitioning a new order, for instance) is
	 * "system". Mirrors the same distinction current_user_actor()
	 * already makes for the audit note, without ever exposing the
	 * email/user id this history log is explicitly forbidden from
	 * storing.
	 */
	private static function determine_history_source() {
		if ( isset( $_SERVER['HTTP_X_COFEO_ACTOR'] ) ) {
			return 'admin';
		}
		$user = wp_get_current_user();
		if ( $user && $user->exists() ) {
			return 'admin';
		}
		return 'system';
	}

	/**
	 * `X-Cofeo-Actor` is set only by COFEO's own secure mutation layer
	 * (lib/woocommerce/order-status-mutation.ts), carrying the real
	 * authenticated admin's identity — without it, every COFEO-app-
	 * initiated REST API call would otherwise be attributed to
	 * whichever WordPress user owns the REST API consumer key/secret
	 * pair (always the same one), not the actual admin who acted. It's
	 * purely informational (never trusted for authorization — the REST
	 * API call itself is already fully authenticated via OAuth1.0a
	 * before this hook ever runs), so a missing or spoofed value only
	 * ever affects how a note is *labeled*, never what it's allowed to
	 * do. wp-admin-initiated changes have no such header and fall back
	 * to the real logged-in WordPress user.
	 */
	private static function write_note( $order, $old_cofeo, $new_cofeo ) {
		$actor = isset( $_SERVER['HTTP_X_COFEO_ACTOR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_COFEO_ACTOR'] ) )
			: self::current_user_actor();

		$note = sprintf(
			"COFEO status changed: %s → %s\nActor: %s\nTimestamp: %s",
			$old_cofeo,
			$new_cofeo,
			$actor,
			gmdate( 'c' )
		);

		$order->add_order_note( $note, 0, false );
	}

	private static function current_user_actor() {
		$user = wp_get_current_user();
		if ( $user && $user->exists() ) {
			return sprintf( '%s (%d)', $user->user_email, $user->ID );
		}
		return 'system';
	}
}

add_action( 'init', array( 'Cofeo_Order_Status', 'register_statuses' ) );
add_filter( 'wc_order_statuses', array( 'Cofeo_Order_Status', 'filter_order_statuses' ) );
add_action( 'woocommerce_order_status_changed', array( 'Cofeo_Order_Status', 'on_status_changed' ), 10, 4 );
