<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
	return;
}

/**
 * wp cofeo-shipping seed-rates
 *
 * The ONE persistent database write for shipping: creates the initial
 * `cofeo_shipping_rates` option (default rate + Mohammedia/Casablanca
 * overrides). Deliberately NOT hooked into plugins_loaded/init/plugin
 * activation — this only ever runs when explicitly invoked from the
 * CLI, after separate explicit approval of the exact value being
 * written, never automatically just because the plugin is active.
 */
class Cofeo_Shipping_CLI {

	/**
	 * Seed the initial shipping-rate configuration.
	 *
	 * ## OPTIONS
	 *
	 * [--force]
	 * : Overwrite an existing configuration instead of refusing. Without
	 * this flag, the command refuses if cofeo_shipping_rates already
	 * exists, so a second accidental run can't silently clobber
	 * admin-made changes.
	 *
	 * ## EXAMPLES
	 *
	 *     wp cofeo-shipping seed-rates
	 */
	public function seed_rates( $args, $assoc_args ) {
		$force = isset( $assoc_args['force'] );

		if ( ! $force && get_option( Cofeo_Shipping_Rates::OPTION_NAME, null ) !== null ) {
			WP_CLI::error( 'cofeo_shipping_rates already exists — pass --force to overwrite.' );
			return;
		}

		$config = array(
			'default'   => 4900,
			'overrides' => array(
				'Mohammedia' => 0,
				'Casablanca' => 2900,
			),
		);

		update_option( Cofeo_Shipping_Rates::OPTION_NAME, $config, false );

		WP_CLI::success( 'cofeo_shipping_rates seeded: default=4900 (49.00 MAD), overrides={Mohammedia:0, Casablanca:2900}' );
	}
}

WP_CLI::add_command( 'cofeo-shipping', 'Cofeo_Shipping_CLI' );
