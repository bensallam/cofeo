<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Public, read-only, credential-free REST endpoint — the approved
 * integration boundary for the Next.js frontend to retrieve the exact
 * city list. Its own namespace (cofeo/v1), deliberately never wc/v3,
 * no authentication required — same public-read posture as the Store
 * API's own product/category endpoints. Returns city labels exactly as
 * stored in shipping/data/cities.txt, in file order.
 */
class Cofeo_Shipping_Rest {

	public static function register_routes() {
		register_rest_route(
			'cofeo/v1',
			'/shipping-cities',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_cities' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public static function get_cities( WP_REST_Request $request ) {
		$response = rest_ensure_response(
			array(
				'cities' => Cofeo_Shipping_Cities::get_all(),
			)
		);
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
add_action( 'rest_api_init', array( 'Cofeo_Shipping_Rest', 'register_routes' ) );
