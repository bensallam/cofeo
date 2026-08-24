<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Phase 4B — emits the `order.status.changed` event to the COFEO
 * Next.js app whenever a WooCommerce order's status changes, so that
 * app (which owns the FR/EN/AR translations, branding, and the
 * customer tracking URL structure — see lib/notifications/ there) can
 * decide whether/how to notify the customer.
 *
 * Deliberately separate from, and hooked independently of,
 * class-cofeo-order-status.php: that class is the just-verified
 * source of the order-status PERSISTENCE fix and must not be touched
 * again in this phase. WordPress hooks support multiple independent
 * callbacks on the same action natively — this class adds a second,
 * unrelated listener on `woocommerce_order_status_changed` rather than
 * modifying the first one. This listener never reads or writes an
 * order's status itself, so it cannot reintroduce the rollback bug or
 * interfere with that class's behavior in any way.
 *
 * The payload sent is deliberately minimal — just the order id, never
 * the old/new status strings themselves. The receiver re-fetches the
 * order fresh from the WooCommerce REST API and derives the truth
 * itself, rather than trusting whatever this call happens to send —
 * the same "never trust the caller, always re-fetch" principle
 * lib/woocommerce/order-status-mutation.ts already applies to writes,
 * applied here to a read/notify path instead.
 *
 * Failure here is always non-fatal: a slow or unreachable Next.js
 * instance must never break an admin saving a status change (or the
 * checkout flow that leads here indirectly via woocommerce_new_order).
 * A short timeout and swallowed WP_Error are how that's guaranteed —
 * see on_status_changed() below.
 */
class Cofeo_Notification_Dispatcher {

	/**
	 * WordPress housekeeping/internal statuses that never correspond to
	 * a real COFEO customer-facing state — skipped purely to avoid
	 * needless network calls during checkout drafts, trashing a test
	 * order, etc. This is an event-volume optimization only; it is NOT
	 * status-transition enforcement (nothing here ever rejects or
	 * reverts anything) and mirrors the same housekeeping-status list
	 * class-cofeo-order-status.php's own map_to_cofeo() treats as "not
	 * part of the COFEO model."
	 */
	const IGNORED_STATUSES = array( 'trash', 'auto-draft', 'checkout-draft' );

	public static function on_status_changed( $order_id, $old_status, $new_status, $order ) {
		unset( $old_status, $order ); // Intentionally unused — see class docblock: the receiver re-derives truth itself.

		$normalized_new = preg_replace( '/^wc-/', '', (string) $new_status );
		if ( in_array( $normalized_new, self::IGNORED_STATUSES, true ) ) {
			return;
		}

		$config = Cofeo_Notification_Settings::get_config();
		if ( empty( $config['webhook_secret'] ) ) {
			error_log( 'COFEO notification webhook: no webhook secret configured — skipping dispatch for order #' . $order_id );
			return;
		}

		$response = wp_remote_post(
			$config['webhook_url'],
			array(
				'timeout'  => 5,
				'blocking' => true,
				'headers'  => array(
					'Content-Type'            => 'application/json',
					'X-Cofeo-Webhook-Secret'  => $config['webhook_secret'],
				),
				'body'     => wp_json_encode( array( 'orderId' => (int) $order_id ) ),
			)
		);

		if ( is_wp_error( $response ) ) {
			// Never surfaced to the admin/customer — logged only. The
			// order's own status write already succeeded and is
			// unaffected; this is purely a best-effort notification.
			error_log( 'COFEO notification webhook failed for order #' . $order_id . ': ' . $response->get_error_message() );
			return;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code >= 300 ) {
			error_log( 'COFEO notification webhook for order #' . $order_id . ' returned HTTP ' . $code );
		}
	}
}

add_action( 'woocommerce_order_status_changed', array( 'Cofeo_Notification_Dispatcher', 'on_status_changed' ), 20, 4 );
