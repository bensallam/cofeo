<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Declares that Morocco's `state` and `postcode` address fields are
 * not required and not shown. COFEO's delivery is resolved entirely
 * from the custom city list (see the shipping module), not from
 * state/postcode — Morocco has no country-specific override in
 * WooCommerce core, so it otherwise inherits the `default` locale,
 * where both fields are required.
 *
 * This uses WooCommerce's own public `woocommerce_get_country_locale`
 * filter — the same mechanism WooCommerce core itself uses to mark
 * these fields not required for other countries (e.g. AE, AF already
 * ship with postcode/state marked not required in
 * WC_Countries::get_country_locale()). No core files are modified and
 * no data is ever fabricated for these fields — they are genuinely
 * optional for how this store operates.
 */
class Cofeo_Checkout_Locale {

	public static function filter_country_locale( $locales ) {
		$locales['MA']['state'] = array(
			'required' => false,
			'hidden'   => true,
		);
		$locales['MA']['postcode'] = array(
			'required' => false,
			'hidden'   => true,
		);
		return $locales;
	}
}
add_filter( 'woocommerce_get_country_locale', array( 'Cofeo_Checkout_Locale', 'filter_country_locale' ) );
