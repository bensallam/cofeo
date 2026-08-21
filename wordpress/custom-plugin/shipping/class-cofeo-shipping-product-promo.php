<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Data/architecture only for a product-level free-shipping promotion —
 * a flag plus an optional date window, stored as product meta.
 * Deliberately NOT wired into any shipping-rate calculation: how a cart
 * mixing promotional and non-promotional products should be charged is
 * an open business question, not decided here (per the Phase 7 shipping
 * sign-off). This module only makes the data capturable and readable —
 * class-cofeo-shipping-cart.php never consults it.
 *
 * Uses WooCommerce's own product-edit save flow (woocommerce_process_
 * product_meta), which WordPress/WooCommerce core already nonce- and
 * capability-protects before this hook fires — no separate check needed
 * here, consistent with how WooCommerce's own extensions add fields.
 */
class Cofeo_Shipping_Product_Promo {

	const META_ENABLED = '_cofeo_free_shipping_promo';
	const META_START   = '_cofeo_free_shipping_promo_start';
	const META_END     = '_cofeo_free_shipping_promo_end';

	public static function render_fields() {
		echo '<div class="options_group cofeo-free-shipping-promo">';

		woocommerce_wp_checkbox(
			array(
				'id'          => self::META_ENABLED,
				'label'       => __( 'COFEO free shipping promotion', 'cofeo' ),
				'description' => __( 'Marks this product as eligible for a free-shipping promotion. Not yet applied to cart shipping calculation.', 'cofeo' ),
			)
		);

		woocommerce_wp_text_input(
			array(
				'id'    => self::META_START,
				'label' => __( 'Promotion start date', 'cofeo' ),
				'type'  => 'date',
			)
		);

		woocommerce_wp_text_input(
			array(
				'id'    => self::META_END,
				'label' => __( 'Promotion end date', 'cofeo' ),
				'type'  => 'date',
			)
		);

		echo '</div>';
	}

	/**
	 * @param int $product_id
	 * @return bool True if this product's free-shipping promo is enabled
	 *              and (when dates are set) today falls within the window.
	 *              An unset date bound is treated as "no limit" on that
	 *              side, not as "inactive".
	 */
	public static function is_active_for_product( $product_id ) {
		if ( get_post_meta( $product_id, self::META_ENABLED, true ) !== 'yes' ) {
			return false;
		}

		$today = current_time( 'Y-m-d' );
		$start = get_post_meta( $product_id, self::META_START, true );
		$end   = get_post_meta( $product_id, self::META_END, true );

		if ( $start && $today < $start ) {
			return false;
		}
		if ( $end && $today > $end ) {
			return false;
		}

		return true;
	}

	/**
	 * @param array $package_contents WC_Cart package 'contents' array.
	 * @return bool True if ANY item in the package has an active promo —
	 *              per the Phase 8 sign-off, one promotional item makes
	 *              the whole order's shipping free, not just that line.
	 */
	public static function cart_has_active_promo( $package_contents ) {
		foreach ( $package_contents as $item ) {
			$product_id = isset( $item['product_id'] ) ? (int) $item['product_id'] : 0;
			if ( $product_id && self::is_active_for_product( $product_id ) ) {
				return true;
			}
		}
		return false;
	}

	public static function save_fields( $post_id ) {
		$enabled = isset( $_POST[ self::META_ENABLED ] ) ? 'yes' : 'no';
		update_post_meta( $post_id, self::META_ENABLED, $enabled );

		if ( isset( $_POST[ self::META_START ] ) ) {
			update_post_meta( $post_id, self::META_START, sanitize_text_field( wp_unslash( $_POST[ self::META_START ] ) ) );
		}

		if ( isset( $_POST[ self::META_END ] ) ) {
			update_post_meta( $post_id, self::META_END, sanitize_text_field( wp_unslash( $_POST[ self::META_END ] ) ) );
		}
	}
}
add_action( 'woocommerce_product_options_shipping', array( 'Cofeo_Shipping_Product_Promo', 'render_fields' ) );
add_action( 'woocommerce_process_product_meta', array( 'Cofeo_Shipping_Product_Promo', 'save_fields' ) );
