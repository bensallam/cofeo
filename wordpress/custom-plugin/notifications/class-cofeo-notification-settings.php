<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configuration for the outbound order-status webhook (Phase 4B) —
 * where to send it and the shared secret that proves the call really
 * came from this WordPress install. Follows the same "single wp_option,
 * no secrets hardcoded in code" pattern as
 * class-cofeo-bank-transfer-settings.php.
 *
 * No admin settings page exists for this yet (Phase 4B deliberately
 * keeps scope tight — see that phase's audit, Part 8: "only implement
 * what is necessary"). Configuration is read from environment
 * variables first (the same `${...}` passthrough docker-compose.yml
 * already uses for WORDPRESS_DB_* — see COFEO_NOTIFICATION_WEBHOOK_URL
 * / COFEO_NOTIFICATION_WEBHOOK_SECRET there), falling back to the
 * wp_option (settable via `wp option update` if ever needed without a
 * container restart), falling back to a same-machine dev default for
 * the URL only — never for the secret, which must always be explicitly
 * configured or the dispatcher refuses to send (fail closed, see
 * class-cofeo-notification-dispatcher.php).
 */
class Cofeo_Notification_Settings {

	const OPTION_NAME = 'cofeo_notification_settings';

	/**
	 * Colima/Docker Desktop's standard bridge from a container back to
	 * the host machine — this project's Next.js dev server runs
	 * natively on the host (`pnpm dev`), not in a container (there is
	 * no `frontend` service in docker-compose.yml). Used only when
	 * neither the env var nor the wp_option supplies a URL — a
	 * reasonable local-dev default, never assumed correct for any
	 * other environment.
	 */
	const DEV_DEFAULT_WEBHOOK_URL = 'http://host.docker.internal:3000/api/webhooks/order-status-changed';

	/**
	 * @return array{webhook_url:string, webhook_secret:string}
	 */
	public static function get_config() {
		$stored = get_option( self::OPTION_NAME, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$env_url    = getenv( 'COFEO_NOTIFICATION_WEBHOOK_URL' );
		$env_secret = getenv( 'COFEO_NOTIFICATION_WEBHOOK_SECRET' );

		$webhook_url = $env_url ? $env_url : ( isset( $stored['webhook_url'] ) ? (string) $stored['webhook_url'] : self::DEV_DEFAULT_WEBHOOK_URL );
		$webhook_secret = $env_secret ? $env_secret : ( isset( $stored['webhook_secret'] ) ? (string) $stored['webhook_secret'] : '' );

		return array(
			'webhook_url'    => $webhook_url,
			'webhook_secret' => $webhook_secret,
		);
	}
}
