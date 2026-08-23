<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Brute-force protection for the register/login endpoints, using
 * WordPress's own Transients API — no new datastore, same
 * infrastructure WordPress core and WooCommerce already rely on for
 * short-lived counters. Keys are always prefixed and never store the
 * raw attempted password, only a count.
 */
class Cofeo_Auth_Rate_Limit {

	const MAX_ATTEMPTS   = 5;
	const WINDOW_SECONDS = 900; // 15 minutes.

	private static function transient_key( $key ) {
		return 'cofeo_auth_attempts_' . md5( $key );
	}

	public static function is_limited( $key ) {
		return (int) get_transient( self::transient_key( $key ) ) >= self::MAX_ATTEMPTS;
	}

	public static function record_attempt( $key ) {
		$transient_key = self::transient_key( $key );
		$count         = (int) get_transient( $transient_key );
		set_transient( $transient_key, $count + 1, self::WINDOW_SECONDS );
	}

	public static function reset( $key ) {
		delete_transient( self::transient_key( $key ) );
	}
}
