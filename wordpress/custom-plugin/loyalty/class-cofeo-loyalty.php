<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Phase 4E — the COFEO loyalty points ledger. A third, fully
 * independent listener on `woocommerce_order_status_changed` (alongside
 * class-cofeo-order-status.php's history/audit-note writer and
 * class-cofeo-notification-dispatcher.php's webhook emitter) — never
 * modifies either of those, never writes an order's `status` field
 * itself, and is safe to disable or remove without affecting anything
 * else this codebase already does.
 *
 * The dedicated ledger table (class-cofeo-loyalty-schema.php,
 * class-cofeo-loyalty-ledger.php) is the sole source of truth and the
 * only place with a real concurrency guarantee. After every successful
 * ledger write, this class ALSO projects the same transaction onto
 * order meta and WooCommerce customer meta
 * (project_order_transactions()/project_customer_ledger() below) —
 * purely a denormalized READ CACHE for the Next.js frontend, which
 * already has a fully authenticated, working read path for both (the
 * same `/wc/v3/orders/{id}` and `/wc/v3/customers/{id}` calls
 * lib/woocommerce/order.ts and lib/auth/session.ts already make). This
 * is what lets Phase 4E ship with NO new REST endpoint and NO new
 * authentication mechanism: reads reuse 100% of the existing,
 * already-proven WooCommerce REST integration. If a projection write
 * ever fails, the ledger table is already durably correct and the
 * projection is simply stale until the next successful earn/reversal
 * for that customer/order recomputes it fresh — every projection write
 * below is a full recompute from the ledger, never an increment, so
 * it's safe to retry or run redundantly.
 */
class Cofeo_Loyalty {

	const ORDER_META_TXN_PREFIX = '_cofeo_loyalty_txn_';

	/**
	 * Deliberately NOT underscore-prefixed, unlike every other COFEO
	 * meta key in this codebase (`_cofeo_*`) and unlike
	 * ORDER_META_TXN_PREFIX just above. WooCommerce's Orders REST
	 * controller returns every order meta entry regardless of key
	 * (proven throughout Phases 4C/4D and again for
	 * ORDER_META_TXN_PREFIX above), but its Customers REST controller
	 * does NOT: a leading underscore marks a meta key "protected" by
	 * WordPress's own `is_protected_meta()` convention, and the
	 * customer controller — unlike the order one — actually honors
	 * that and silently omits such entries from `/wc/v3/customers/{id}`
	 * (confirmed empirically while building this feature: an
	 * underscore-prefixed customer meta key round-trips correctly in
	 * PHP but never appears in the REST response at all). Dropping the
	 * underscore is the fix; it changes nothing about how this data is
	 * written or interpreted, only whether the one REST endpoint
	 * lib/woocommerce/loyalty.ts reads (`/wc/v3/customers/{id}`) can
	 * see it.
	 */
	const CUSTOMER_META_TXN_PREFIX         = 'cofeo_loyalty_txn_';
	const CUSTOMER_META_BALANCE_KEY        = 'cofeo_loyalty_balance';
	const CUSTOMER_META_TOTAL_EARNED_KEY   = 'cofeo_loyalty_total_earned';
	const CUSTOMER_META_TOTAL_REVERSED_KEY = 'cofeo_loyalty_total_reversed';

	/**
	 * Mirrors class-cofeo-order-status.php's own private map_to_cofeo()
	 * exactly. Deliberately its own copy, not a shared import: that
	 * file is explicitly protected/untouchable for Phase 4E, and this
	 * class must remain fully independent of it (see class docblock) —
	 * the same reasoning class-cofeo-order-status.php itself already
	 * documents for why it doesn't import lib/woocommerce/order-status.ts's
	 * TypeScript version either. Returns null for anything outside the
	 * COFEO model (trash, auto-draft, checkout-draft, ...), which the
	 * caller uses to skip entirely — never guessed as a real transition.
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

	public static function on_status_changed( $order_id, $old_status, $new_status, $order ) {
		$old_cofeo = self::map_to_cofeo( $old_status );
		$new_cofeo = self::map_to_cofeo( $new_status );

		if ( null === $old_cofeo || null === $new_cofeo || $old_cofeo === $new_cofeo ) {
			return;
		}

		$customer_id = (int) $order->get_customer_id();
		if ( $customer_id <= 0 ) {
			// Guest order — never earns or reverses. There is no
			// stable, persistent identity to attach a balance to
			// (Phase 4E identity strategy: wooCustomerId only, never
			// email), and under this same rule a guest order could
			// never have had a prior EARN either, so there is nothing
			// to reverse.
			return;
		}

		if ( Cofeo_Loyalty_Rules::is_earning_trigger( $old_cofeo, $new_cofeo ) ) {
			self::handle_earn( $order, $order_id, $customer_id );
		} elseif ( Cofeo_Loyalty_Rules::is_reversal_trigger( $old_cofeo, $new_cofeo ) ) {
			self::handle_reversal( $order, $order_id );
		}
	}

	private static function handle_earn( $order, $order_id, $customer_id ) {
		$points = Cofeo_Loyalty_Rules::calculate_points_for_order( $order );
		if ( $points <= 0 ) {
			// A zero-total (or zero-earning-base) order — correctly a
			// no-op, not an error; nothing to record.
			return;
		}

		$recorded_points = Cofeo_Loyalty_Ledger::record_earn( $order_id, $customer_id, $points );
		if ( false === $recorded_points ) {
			// Duplicate hook firing for the same episode, or an
			// already-active episode — decided by the ledger table's
			// own UNIQUE constraint (see record_earn()'s docblock),
			// not guessed here. Nothing new to note or project.
			return;
		}

		$order->add_order_note(
			sprintf( 'COFEO loyalty: +%d points earned.', $recorded_points ),
			0,
			false
		);

		self::refresh_projections( $order_id, $customer_id );
	}

	private static function handle_reversal( $order, $order_id ) {
		$reversed_points = Cofeo_Loyalty_Ledger::record_reversal( $order_id );
		if ( false === $reversed_points ) {
			// No active EARN to reverse — a correct no-op per the
			// Phase 4E spec, never an error and never a negative
			// balance.
			return;
		}

		$order->add_order_note(
			sprintf( 'COFEO loyalty: %d points reversed.', $reversed_points ),
			0,
			false
		);

		self::refresh_projections( $order_id, (int) $order->get_customer_id() );
	}

	private static function refresh_projections( $order_id, $customer_id ) {
		self::project_order_transactions( $order_id );
		self::project_customer_ledger( $customer_id );
	}

	/** Rewrites this order's own loyalty-transaction meta entries fresh
	 *  from the ledger table — read by the admin order-detail page's
	 *  loyalty section. Uses `update_meta_data()` (overwrite-if-exists,
	 *  deterministic key), never `add_meta_data(..., false)`, so this
	 *  is idempotent under any number of repeated calls. */
	private static function project_order_transactions( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$rows = Cofeo_Loyalty_Ledger::get_ledger_for_order( $order_id );
		foreach ( $rows as $row ) {
			$key   = self::ORDER_META_TXN_PREFIX . $row->episode . '_' . strtoupper( $row->type );
			$value = wp_json_encode(
				array(
					'type'      => strtoupper( $row->type ),
					'points'    => (int) $row->points,
					'episode'   => (int) $row->episode,
					'reason'    => $row->reason,
					'createdAt' => self::to_iso8601( $row->created_at ),
				)
			);
			$order->update_meta_data( $key, $value );
		}
		$order->save_meta_data();
	}

	/** Rewrites the customer's cached balance AND every one of their
	 *  loyalty transactions fresh from the ledger table — read by the
	 *  customer's own /account/loyalty page and the admin order-detail
	 *  page's "customer balance" line. `WC_Customer` implements the
	 *  same WC_Data meta trait WC_Order does, so this is exactly the
	 *  same idempotent overwrite pattern as project_order_transactions()
	 *  above, applied to the customer record instead of the order. */
	private static function project_customer_ledger( $customer_id ) {
		if ( ! class_exists( 'WC_Customer' ) ) {
			return;
		}
		$customer = new WC_Customer( $customer_id );
		if ( ! $customer->get_id() ) {
			return;
		}

		$balances = Cofeo_Loyalty_Ledger::get_balance_for_customer( $customer_id );
		$customer->update_meta_data( self::CUSTOMER_META_BALANCE_KEY, $balances['balance'] );
		$customer->update_meta_data( self::CUSTOMER_META_TOTAL_EARNED_KEY, $balances['totalEarned'] );
		$customer->update_meta_data( self::CUSTOMER_META_TOTAL_REVERSED_KEY, $balances['totalReversed'] );

		$rows = Cofeo_Loyalty_Ledger::get_ledger_for_customer( $customer_id );
		foreach ( $rows as $row ) {
			$key   = self::CUSTOMER_META_TXN_PREFIX . $row->order_id . '_' . $row->episode . '_' . strtoupper( $row->type );
			$value = wp_json_encode(
				array(
					'type'      => strtoupper( $row->type ),
					'points'    => (int) $row->points,
					'orderId'   => (int) $row->order_id,
					'episode'   => (int) $row->episode,
					'reason'    => $row->reason,
					'createdAt' => self::to_iso8601( $row->created_at ),
				)
			);
			$customer->update_meta_data( $key, $value );
		}
		$customer->save_meta_data();
	}

	private static function to_iso8601( $mysql_datetime_utc ) {
		$timestamp = strtotime( $mysql_datetime_utc . ' UTC' );
		return $timestamp ? gmdate( 'c', $timestamp ) : gmdate( 'c' );
	}
}

add_action( 'woocommerce_order_status_changed', array( 'Cofeo_Loyalty', 'on_status_changed' ), 30, 4 );
