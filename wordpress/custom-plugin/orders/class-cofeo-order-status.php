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
