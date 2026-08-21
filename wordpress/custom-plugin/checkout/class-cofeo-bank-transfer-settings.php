<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bank-transfer display details — account holder, bank name, RIB, IBAN,
 * BIC/SWIFT, and the instructions text shown to the customer. Stored as
 * a single wp_option, entirely separate from the gateway's own
 * enabled/title/description settings (those live in the standard
 * woocommerce_cofeo_bank_transfer_settings option that WC_Payment_Gateway
 * itself manages via Cofeo_Gateway_Bank_Transfer). Never guesses a
 * value — every field defaults to an empty string until an admin fills
 * it in via the COFEO Bank Transfer settings page.
 */
class Cofeo_Bank_Transfer_Settings {

	const OPTION_NAME = 'cofeo_bank_transfer_details';

	const FIELDS = array( 'account_holder', 'bank_name', 'rib', 'iban', 'bic', 'instructions' );

	/**
	 * @return array<string,string> All six fields, each defaulting to ''
	 *                                if never configured.
	 */
	public static function get_config() {
		$stored = get_option( self::OPTION_NAME, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$config = array();
		foreach ( self::FIELDS as $field ) {
			$config[ $field ] = isset( $stored[ $field ] ) ? (string) $stored[ $field ] : '';
		}
		return $config;
	}

	/**
	 * @param array<string,string> $fields Only recognized keys are stored;
	 *                                       anything else is dropped.
	 */
	public static function update( $fields ) {
		$config = self::get_config();
		foreach ( self::FIELDS as $field ) {
			if ( array_key_exists( $field, $fields ) ) {
				$config[ $field ] = (string) $fields[ $field ];
			}
		}
		update_option( self::OPTION_NAME, $config, false );
	}
}
