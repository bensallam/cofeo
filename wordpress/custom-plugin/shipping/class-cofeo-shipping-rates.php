<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configurable shipping-rate resolution: a default rate plus per-city
 * overrides, stored in a single wp_option as the backend source of
 * truth. Amounts are MAD minor units (centimes), matching the
 * currency-minor-unit convention already used throughout the Store API
 * data layer on the frontend. Nothing here is hardcoded in Next.js —
 * every price a customer sees comes from this option via the real
 * WooCommerce shipping calculation (see class-cofeo-shipping-cart.php).
 */
class Cofeo_Shipping_Rates {

	const OPTION_NAME = 'cofeo_shipping_rates';

	/**
	 * @return array{default: int|null, overrides: array<string,int>}
	 *              A safe fallback shape (default null, no overrides) is
	 *              returned if the option hasn't been seeded yet — never
	 *              a guessed/invented rate.
	 */
	public static function get_config() {
		$stored = get_option( self::OPTION_NAME, null );

		if ( ! is_array( $stored ) || ! array_key_exists( 'default', $stored ) || ! isset( $stored['overrides'] ) || ! is_array( $stored['overrides'] ) ) {
			return array(
				'default'   => null,
				'overrides' => array(),
			);
		}

		return $stored;
	}

	public static function get_default() {
		return self::get_config()['default'];
	}

	public static function get_overrides() {
		return self::get_config()['overrides'];
	}

	public static function is_overridden( $city ) {
		return array_key_exists( $city, self::get_overrides() );
	}

	/**
	 * @return int|null Rate in MAD minor units. Null means "fail safely"
	 *                   — either the city isn't in the master list, or no
	 *                   default has been configured yet. Callers must
	 *                   never substitute an invented value for null.
	 */
	public static function resolve_for_city( $city ) {
		if ( ! Cofeo_Shipping_Cities::exists( $city ) ) {
			return null;
		}

		$config = self::get_config();

		if ( array_key_exists( $city, $config['overrides'] ) ) {
			return (int) $config['overrides'][ $city ];
		}

		return $config['default'];
	}

	public static function set_default( $minor_units ) {
		$config            = self::get_config();
		$config['default'] = max( 0, (int) $minor_units );
		update_option( self::OPTION_NAME, $config, false );
	}

	/**
	 * @return bool False (no write performed) if the city isn't in the
	 *              master list — fails closed rather than creating an
	 *              override for a city that doesn't exist.
	 */
	public static function set_override( $city, $minor_units ) {
		if ( ! Cofeo_Shipping_Cities::exists( $city ) ) {
			return false;
		}

		$config                       = self::get_config();
		$config['overrides'][ $city ] = max( 0, (int) $minor_units );
		update_option( self::OPTION_NAME, $config, false );
		return true;
	}

	public static function restore_default( $city ) {
		$config = self::get_config();
		unset( $config['overrides'][ $city ] );
		update_option( self::OPTION_NAME, $config, false );
	}
}
