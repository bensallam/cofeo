<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Public, read-only, credential-free REST endpoint for the bank-transfer
 * display details — same integration posture as Cofeo_Shipping_Rest
 * (own cofeo/v1 namespace, never wc/v3, no authentication). Returns the
 * configured fields only when the cofeo_bank_transfer gateway is itself
 * enabled; while it's off, every field comes back empty so unlaunched
 * bank details can never be scraped ahead of time.
 */
class Cofeo_Bank_Transfer_Rest {

	public static function register_routes() {
		register_rest_route(
			'cofeo/v1',
			'/bank-transfer',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_details' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	private static function is_gateway_enabled() {
		$settings = get_option( 'woocommerce_' . Cofeo_Gateway_Bank_Transfer::ID . '_settings', array() );
		return is_array( $settings ) && isset( $settings['enabled'] ) && 'yes' === $settings['enabled'];
	}

	public static function get_details( WP_REST_Request $request ) {
		$enabled = self::is_gateway_enabled();
		$fields  = $enabled
			? Cofeo_Bank_Transfer_Settings::get_config()
			: array_fill_keys( Cofeo_Bank_Transfer_Settings::FIELDS, '' );

		$response = rest_ensure_response(
			array_merge( array( 'enabled' => $enabled ), $fields )
		);
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
add_action( 'rest_api_init', array( 'Cofeo_Bank_Transfer_Rest', 'register_routes' ) );
