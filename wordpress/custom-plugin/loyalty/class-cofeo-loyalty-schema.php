<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Phase 4E — creates and version-manages the one dedicated custom table
 * this codebase uses. Every other COFEO module stores its data as
 * WooCommerce order/customer meta or WordPress options (see every
 * other file under wordpress/custom-plugin/) specifically because none
 * of them ever needed a real, database-enforced uniqueness guarantee.
 * The loyalty ledger does: "award at most one EARN per earning episode,
 * even under two genuinely concurrent status-change events for the
 * same order" cannot be guaranteed by WC_Data::add_meta_data()'s
 * "unique" flag, which is an application-level SELECT-then-INSERT, not
 * a table constraint (see class-cofeo-loyalty-ledger.php's own
 * docblock) — this table's UNIQUE KEY on (order_id, episode, type) is
 * the actual mechanism that makes the concurrency guarantee real.
 *
 * No `register_activation_hook` is used: this plugin is already active
 * in every real deployment of this repo (see cofeo-core.php's own
 * bootstrap comment and scripts/setup.sh), so a plugin-activation hook
 * would never fire again after this code is deployed via a normal git
 * pull. `maybe_upgrade()` is called unconditionally from
 * `cofeo_bootstrap()` instead — a single cheap `get_option()` read on
 * every request, and `dbDelta()` itself only actually runs the one time
 * the stored version doesn't match the code's version (i.e. once, the
 * first request after this file is deployed). `dbDelta()` is also
 * idempotent by design — safe to call repeatedly even if this ever ran
 * more than once (e.g. two web workers racing on first deploy).
 */
class Cofeo_Loyalty_Schema {

	const DB_VERSION_OPTION = 'cofeo_loyalty_db_version';

	/** Bump this and adjust install() together whenever the schema
	 *  itself changes — the one signal maybe_upgrade() acts on. */
	const DB_VERSION = '1.0.0';

	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'cofeo_loyalty_ledger';
	}

	public static function maybe_upgrade() {
		if ( get_option( self::DB_VERSION_OPTION ) !== self::DB_VERSION ) {
			self::install();
		}
	}

	/**
	 * `episode` (see class-cofeo-loyalty-ledger.php) is what makes
	 * "EARN -> REVERSAL -> EARN" for the same order representable
	 * without ever deleting or rewriting a row: each earn/reverse cycle
	 * for one order gets its own episode number, and the UNIQUE KEY
	 * enforces "at most one EARN and at most one REVERSAL per episode"
	 * at the database level, not merely in application code.
	 *
	 * `points` is UNSIGNED — this table never stores a negative number;
	 * a REVERSAL's *effect* on the balance is negative, but that's
	 * expressed by `type`, never by the stored magnitude, so the
	 * ledger reads the same way class-cofeo-order-status.php's history
	 * events do ("what happened", not "the signed delta").
	 */
	public static function install() {
		global $wpdb;

		$table            = self::table_name();
		$charset_collate  = $wpdb->get_charset_collate();

		// dbDelta() is picky about exact formatting (two spaces before
		// KEY/PRIMARY KEY definitions, no trailing commas) — see
		// https://developer.wordpress.org/reference/functions/dbdelta/.
		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			customer_id BIGINT UNSIGNED NOT NULL,
			order_id BIGINT UNSIGNED NOT NULL,
			episode INT UNSIGNED NOT NULL,
			type VARCHAR(20) NOT NULL,
			points INT UNSIGNED NOT NULL,
			reason VARCHAR(64) NOT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uniq_order_episode_type (order_id, episode, type),
			KEY customer_id (customer_id),
			KEY order_id (order_id)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		update_option( self::DB_VERSION_OPTION, self::DB_VERSION );
	}
}
