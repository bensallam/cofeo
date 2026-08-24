<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
	return;
}

/**
 * wp cofeo-order-status migrate [--dry-run]
 *
 * A one-time, explicitly-invoked migration for orders created before
 * Phase 4A's real `cofeo-preparing`/`cofeo-shipped`/`cofeo-outfordel`
 * statuses existed: back then, that sub-state lived only in the
 * `_cofeo_order_status` meta field while the real WooCommerce status
 * stayed `processing` (see Cofeo_Order_Status::LEGACY_META_KEY). This
 * moves such an order's REAL status to match what the meta already
 * claimed, via the same CRUD API (`$order->set_status()`/`save()`)
 * any other status change in this app uses — never a direct database
 * write, correct under HPOS or classic storage either way.
 *
 * Never runs automatically on plugin load or activation — only ever
 * when explicitly invoked, and `--dry-run` previews every order it
 * would touch with zero writes, per Phase 4A Section 17's explicit
 * requirement not to modify historical orders blindly.
 */
class Cofeo_Order_Status_CLI {

	/**
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Preview which orders would be migrated without changing
	 * anything.
	 *
	 * ## EXAMPLES
	 *
	 *     wp cofeo-order-status migrate --dry-run
	 *     wp cofeo-order-status migrate
	 */
	public function migrate( $args, $assoc_args ) {
		$dry_run = isset( $assoc_args['dry-run'] );

		$order_ids = wc_get_orders(
			array(
				'status' => 'processing',
				'limit'  => -1,
				'return' => 'ids',
			)
		);

		$target_for_meta = array(
			'PREPARING'        => 'cofeo-preparing',
			'SHIPPED'          => 'cofeo-shipped',
			'OUT_FOR_DELIVERY' => 'cofeo-outfordel',
		);

		$candidates = 0;
		$migrated   = 0;

		foreach ( $order_ids as $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				continue;
			}

			$meta_status = $order->get_meta( Cofeo_Order_Status::LEGACY_META_KEY );
			if ( ! isset( $target_for_meta[ $meta_status ] ) ) {
				continue;
			}

			$target = $target_for_meta[ $meta_status ];
			++$candidates;
			WP_CLI::log( sprintf( 'Order #%d: processing (meta=%s) -> %s', $order_id, $meta_status, $target ) );

			if ( ! $dry_run ) {
				$order->set_status( $target, __( 'Migrated from legacy _cofeo_order_status meta (Phase 4A).', 'cofeo' ) );
				$order->save();
				++$migrated;
			}
		}

		if ( 0 === $candidates ) {
			WP_CLI::success( 'No orders needed migration.' );
			return;
		}

		WP_CLI::success(
			$dry_run
				? sprintf( 'Dry run complete: %d order(s) would be migrated.', $candidates )
				: sprintf( 'Migrated %d order(s).', $migrated )
		);
	}
}

WP_CLI::add_command( 'cofeo-order-status', 'Cofeo_Order_Status_CLI' );
