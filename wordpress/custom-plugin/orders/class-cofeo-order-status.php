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
 * (b) enforces the exact same transition rules as
 *     lib/woocommerce/order-status.ts's canTransition() for ANY status
 *     change regardless of origin — an admin picking a new status in
 *     wp-admin, or COFEO's own secure mutation endpoint over the REST
 *     API both go through WooCommerce's normal set_status()/save()
 *     path, so both fire the same `woocommerce_order_status_changed`
 *     hook this class listens on. There is no separate enforcement
 *     path to keep in sync — one hook, one source of truth;
 *
 * (c) writes the one audit order note per change. This is now the
 *     single authoritative place that happens: the Next.js mutation
 *     layer (lib/woocommerce/order-status-mutation.ts) no longer
 *     writes its own note, specifically to avoid a duplicate when a
 *     COFEO-initiated change fires this same hook.
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
	 * Mirrors `COFEO_STATUS_DEFINITIONS` in
	 * lib/woocommerce/order-status.ts. Kept in sync by hand — there is
	 * no shared source of truth across the PHP/TypeScript boundary;
	 * any change to the transition graph on one side must be mirrored
	 * on the other (both sides have tests asserting the exact same
	 * transitions, see lib/woocommerce/order-status.test.ts and this
	 * plugin's own tests).
	 */
	const TRANSITIONS = array(
		'NEW'              => array( 'CONFIRMED', 'CANCELLED' ),
		'CONFIRMED'        => array( 'PREPARING', 'CANCELLED' ),
		'PREPARING'        => array( 'SHIPPED', 'CANCELLED' ),
		'SHIPPED'          => array( 'OUT_FOR_DELIVERY', 'CANCELLED' ),
		'OUT_FOR_DELIVERY' => array( 'DELIVERED', 'CANCELLED' ),
		'DELIVERED'        => array(),
		'CANCELLED'        => array(),
	);

	/** Order ids currently being reverted by this class itself — guards
	 *  against the revert's own `update_status()` call re-entering
	 *  `on_status_changed()` and looping (Phase 4A Section 7). */
	private static $reverting = array();

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

	private static function can_transition( $from, $to ) {
		if ( $from === $to ) {
			return false;
		}
		return isset( self::TRANSITIONS[ $from ] ) && in_array( $to, self::TRANSITIONS[ $from ], true );
	}

	/**
	 * Fires for EVERY WooCommerce order status change, from any origin.
	 * An invalid COFEO-model transition is reverted (via `update_status()`,
	 * WooCommerce's own CRUD method — never a raw database write) rather
	 * than silently accepted; Section 13 is explicit that a UI-only
	 * restriction is not enough. A valid transition, or a change that
	 * doesn't move between distinct COFEO states at all (e.g.
	 * pending → on-hold, both NEW), gets exactly one audit note.
	 */
	public static function on_status_changed( $order_id, $old_status, $new_status, $order ) {
		if ( isset( self::$reverting[ $order_id ] ) ) {
			unset( self::$reverting[ $order_id ] );
			return;
		}

		$old_cofeo = self::map_to_cofeo( $old_status );
		$new_cofeo = self::map_to_cofeo( $new_status );

		if ( null === $old_cofeo || null === $new_cofeo ) {
			return;
		}

		if ( $old_cofeo === $new_cofeo ) {
			self::write_note( $order, $old_cofeo, $new_cofeo );
			return;
		}

		if ( ! self::can_transition( $old_cofeo, $new_cofeo ) ) {
			self::$reverting[ $order_id ] = true;
			$order->update_status(
				preg_replace( '/^wc-/', '', (string) $old_status ),
				sprintf(
					/* translators: 1: rejected COFEO status, 2: COFEO status reverted to */
					__( 'Rejected invalid COFEO status transition to "%1$s" — reverted to "%2$s".', 'cofeo' ),
					$new_cofeo,
					$old_cofeo
				)
			);
			return;
		}

		self::write_note( $order, $old_cofeo, $new_cofeo );
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
