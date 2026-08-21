<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * COFEO's own bank-transfer payment gateway (id: cofeo_bank_transfer).
 * Deliberately not native WooCommerce BACS (see the Phase 10 architecture
 * report): BACS's Store API / Blocks integration never forwards its
 * account details or instructions to a headless frontend, and its field
 * set has no RIB (a Moroccan-specific identifier, distinct from IBAN).
 * Reusing BACS's own id would also risk a real collision with the native
 * gateway if it were ever enabled separately, since WooCommerce keys
 * registered gateways by id.
 *
 * This class only ever handles the order-status transition. The
 * customer-facing bank details it never touches are served separately
 * by Cofeo_Bank_Transfer_Rest, sourced from Cofeo_Bank_Transfer_Settings.
 *
 * Ships disabled by default (see init_form_fields()) — must be turned on
 * explicitly from WooCommerce → Settings → Payments once real bank
 * details have been configured under WooCommerce → COFEO Bank Transfer.
 */
class Cofeo_Gateway_Bank_Transfer extends WC_Payment_Gateway {

	const ID = 'cofeo_bank_transfer';

	public function __construct() {
		$this->id                 = self::ID;
		$this->has_fields         = false;
		$this->method_title       = __( 'COFEO Bank Transfer', 'cofeo' );
		$this->method_description = __( 'Places the order on-hold pending manual verification of a bank transfer. Configure the customer-facing bank details under WooCommerce → COFEO Bank Transfer.', 'cofeo' );

		$this->init_form_fields();
		$this->init_settings();

		$this->title       = $this->get_option( 'title' );
		$this->description = $this->get_option( 'description' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
	}

	public function init_form_fields() {
		$this->form_fields = array(
			'enabled'     => array(
				'title'   => __( 'Enable/Disable', 'cofeo' ),
				'type'    => 'checkbox',
				'label'   => __( 'Enable bank transfer', 'cofeo' ),
				'default' => 'no',
			),
			'title'       => array(
				'title'       => __( 'Title', 'cofeo' ),
				'type'        => 'safe_text',
				'description' => __( 'Internal admin-facing title only — the customer-facing label is translated in the storefront and does not read this value.', 'cofeo' ),
				'default'     => __( 'Bank transfer', 'cofeo' ),
				'desc_tip'    => true,
			),
			'description' => array(
				'title'       => __( 'Description', 'cofeo' ),
				'type'        => 'textarea',
				'description' => __( 'Internal admin-facing description only.', 'cofeo' ),
				'default'     => '',
				'desc_tip'    => true,
			),
		);
	}

	/**
	 * Always places the order on-hold, pending manual verification —
	 * this gateway never calls payment_complete() under any
	 * circumstance, because a bank transfer is never confirmed at the
	 * moment of order placement.
	 *
	 * @param int $order_id Order ID.
	 * @return array{result:string,redirect:string}
	 */
	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );
		$order->update_status( 'on-hold', __( 'Awaiting bank transfer verification.', 'cofeo' ) );

		if ( WC()->cart ) {
			WC()->cart->empty_cart();
		}

		return array(
			'result'   => 'success',
			'redirect' => $this->get_return_url( $order ),
		);
	}
}

add_filter(
	'woocommerce_payment_gateways',
	function ( $methods ) {
		$methods[] = 'Cofeo_Gateway_Bank_Transfer';
		return $methods;
	}
);
