<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * City master data — a verbatim, byte-exact copy of the business-provided
 * cities.txt (330 entries) bundled with the plugin and read directly at
 * runtime. Never imported into the database, never normalized, never
 * reordered, never deduplicated — this file IS the single source of
 * truth for which cities exist. To update the list, replace
 * shipping/data/cities.txt wholesale; do not hand-edit individual lines.
 */
class Cofeo_Shipping_Cities {

	const DATA_FILE = __DIR__ . '/data/cities.txt';

	private static $cache = null;

	/**
	 * @return string[] Exact city labels, in file order. No trimming
	 *                   beyond stripping the line-ending itself, no case
	 *                   changes, no accent normalization.
	 */
	public static function get_all() {
		if ( self::$cache !== null ) {
			return self::$cache;
		}

		if ( ! file_exists( self::DATA_FILE ) ) {
			self::$cache = array();
			return self::$cache;
		}

		$contents = file_get_contents( self::DATA_FILE );
		$lines    = explode( "\n", $contents );
		$cities   = array();

		foreach ( $lines as $line ) {
			$name = rtrim( $line, "\r\n" );
			if ( $name === '' ) {
				continue;
			}
			$cities[] = $name;
		}

		self::$cache = $cities;
		return self::$cache;
	}

	/**
	 * Exact string match only — the resolution rule is literal equality,
	 * not fuzzy/case-insensitive/accent-insensitive matching.
	 */
	public static function exists( $city ) {
		return in_array( $city, self::get_all(), true );
	}
}
