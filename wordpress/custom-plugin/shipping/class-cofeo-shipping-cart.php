<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires Cofeo_Shipping_Rates into WooCommerce's real shipping
 * calculation — the only place a shipping price actually reaches a
 * customer-facing total (via the Store API's cart/checkout shipping_rates,
 * same mechanism already relied on since Phase 6). No shipping price is
 * ever computed, cached, or trusted anywhere else — never in the
 * frontend, never from a client-supplied value.
 */
class Cofeo_Shipping_Cart {

	const RATE_ID = 'cofeo_city_rate';

	/**
	 * Fully replaces whatever rates WooCommerce computed, rather than
	 * merging into them. A placeholder shipping method exists only to
	 * satisfy wc_get_shipping_method_count()'s "at least one method"
	 * gate (see class docblock) — its own configured price must never
	 * be able to leak to a customer, so nothing it produces survives
	 * this filter.
	 *
	 * City validity is checked before anything else, regardless of any
	 * promo — an unknown city never gets a shipping rate, promotional
	 * or otherwise (Phase 8 sign-off: this is a data-integrity gate,
	 * not a pricing decision, so a promo doesn't bypass it).
	 */
	public static function filter_package_rates( $rates, $package ) {
		$city = isset( $package['destination']['city'] ) ? trim( $package['destination']['city'] ) : '';

		if ( $city === '' || ! Cofeo_Shipping_Cities::exists( $city ) ) {
			return array();
		}

		$contents = isset( $package['contents'] ) ? $package['contents'] : array();

		if ( Cofeo_Shipping_Product_Promo::cart_has_active_promo( $contents ) ) {
			// Phase 8 sign-off: one active free-shipping-promo item makes
			// the whole order's shipping free, regardless of city tier.
			$cost = 0;
		} else {
			$amount_minor = Cofeo_Shipping_Rates::resolve_for_city( $city );

			if ( $amount_minor === null ) {
				// No default configured yet — fail safely, no invented price.
				return array();
			}

			$decimals = wc_get_price_decimals();
			$cost     = $amount_minor / ( 10 ** $decimals );
		}

		$rate = new WC_Shipping_Rate(
			self::RATE_ID,
			__( 'Livraison COFEO', 'cofeo' ),
			$cost,
			array(),
			'cofeo_shipping'
		);

		return array( self::RATE_ID => $rate );
	}
}
add_filter( 'woocommerce_package_rates', array( 'Cofeo_Shipping_Cart', 'filter_package_rates' ), 10, 2 );
