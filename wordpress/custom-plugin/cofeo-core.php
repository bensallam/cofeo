<?php
/**
 * Plugin Name:       COFEO Core
 * Description:       Custom business logic for the COFEO platform (checkout, shipping, validation, security, product data, admin). Never modifies WordPress or WooCommerce core.
 * Version:            0.1.0
 * Requires at least:  6.4
 * Requires PHP:       8.1
 * Requires Plugins:   woocommerce
 * Author:             COFEO
 * Text Domain:        cofeo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'COFEO_PLUGIN_VERSION', '0.1.0' );
define( 'COFEO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'COFEO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Bail out with an admin notice instead of a fatal error if WooCommerce
 * isn't active — this plugin has no reason to exist without it.
 */
function cofeo_missing_woocommerce_notice() {
	echo '<div class="notice notice-error"><p>';
	esc_html_e( 'COFEO Core requires WooCommerce to be installed and active.', 'cofeo' );
	echo '</p></div>';
}

function cofeo_bootstrap() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', 'cofeo_missing_woocommerce_notice' );
		return;
	}

	// Each module is self-contained; loaded only once WooCommerce is
	// confirmed active. Modules are added incrementally per the COFEO
	// implementation roadmap (checkout, shipping, validation, security,
	// products, admin).

	// Shipping (Phase 7): city master data, configurable rate
	// resolution, the public read-only city-list endpoint, the real
	// cart/checkout shipping calculation, product-level free-shipping
	// promo fields (inert — not yet wired into calculation), and the
	// WP-CLI seed command. Load order matters: dependencies first.
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-cities.php';
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-rates.php';
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-rest.php';
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-cart.php';
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-product-promo.php';
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-admin.php';
	require_once COFEO_PLUGIN_DIR . 'shipping/class-cofeo-shipping-cli.php';

	// Checkout (Phase 9 fix, revised): declares Morocco's state/postcode
	// as not required via WooCommerce's own woocommerce_get_country_locale
	// filter — COFEO's delivery is resolved from the custom city list,
	// not state/postcode, and neither field is customer-facing.
	require_once COFEO_PLUGIN_DIR . 'checkout/class-cofeo-checkout-locale.php';

	// Bank transfer (Phase 10): a dedicated cofeo_bank_transfer payment
	// gateway (never native BACS — see docs/adr, its Store API/Blocks
	// integration never forwards account details to a headless
	// frontend), its own admin-editable settings, admin page, and the
	// public read-only endpoint the frontend reads bank details from.
	// Ships disabled; settings load first since both the admin page and
	// the REST endpoint depend on them.
	require_once COFEO_PLUGIN_DIR . 'checkout/class-cofeo-bank-transfer-settings.php';
	require_once COFEO_PLUGIN_DIR . 'checkout/class-cofeo-bank-transfer-gateway.php';
	require_once COFEO_PLUGIN_DIR . 'checkout/class-cofeo-bank-transfer-admin.php';
	require_once COFEO_PLUGIN_DIR . 'checkout/class-cofeo-bank-transfer-rest.php';
}
add_action( 'plugins_loaded', 'cofeo_bootstrap' );
