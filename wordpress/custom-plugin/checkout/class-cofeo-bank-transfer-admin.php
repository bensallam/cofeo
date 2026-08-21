<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * COFEO Bank Transfer admin page — edit the customer-facing account
 * holder, bank name, RIB, IBAN, BIC/SWIFT, and instructions shown at
 * checkout. Deliberately separate from the gateway's own Enable/Disable
 * toggle (WooCommerce → Settings → Payments → COFEO Bank Transfer) —
 * this page only ever edits Cofeo_Bank_Transfer_Settings's option.
 */
class Cofeo_Bank_Transfer_Admin {

	const NONCE_ACTION = 'cofeo_bank_transfer_admin';
	const CAPABILITY   = 'manage_woocommerce';
	const PAGE_SLUG    = 'cofeo-bank-transfer';

	public static function register_menu() {
		add_submenu_page(
			'woocommerce',
			__( 'COFEO Bank Transfer', 'cofeo' ),
			__( 'COFEO Bank Transfer', 'cofeo' ),
			self::CAPABILITY,
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);
	}

	public static function render_page() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'cofeo' ) );
		}

		$config = Cofeo_Bank_Transfer_Settings::get_config();
		$notice = isset( $_GET['cofeo_notice'] ) ? sanitize_key( wp_unslash( $_GET['cofeo_notice'] ) ) : '';
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'COFEO Bank Transfer', 'cofeo' ); ?></h1>

			<?php if ( 'saved' === $notice ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Bank details saved.', 'cofeo' ); ?></p></div>
			<?php endif; ?>

			<p>
				<?php esc_html_e( 'These details are shown to customers who select bank transfer at checkout. Enabling the payment method itself is done separately, under WooCommerce → Settings → Payments → COFEO Bank Transfer.', 'cofeo' ); ?>
			</p>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( self::NONCE_ACTION, 'cofeo_bank_transfer_nonce' ); ?>
				<input type="hidden" name="action" value="cofeo_save_bank_transfer_details" />
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="cofeo_account_holder"><?php esc_html_e( 'Account holder', 'cofeo' ); ?></label></th>
						<td><input type="text" id="cofeo_account_holder" name="account_holder" value="<?php echo esc_attr( $config['account_holder'] ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="cofeo_bank_name"><?php esc_html_e( 'Bank name', 'cofeo' ); ?></label></th>
						<td><input type="text" id="cofeo_bank_name" name="bank_name" value="<?php echo esc_attr( $config['bank_name'] ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="cofeo_rib"><?php esc_html_e( 'RIB', 'cofeo' ); ?></label></th>
						<td><input type="text" id="cofeo_rib" name="rib" value="<?php echo esc_attr( $config['rib'] ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="cofeo_iban"><?php esc_html_e( 'IBAN', 'cofeo' ); ?></label></th>
						<td><input type="text" id="cofeo_iban" name="iban" value="<?php echo esc_attr( $config['iban'] ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="cofeo_bic"><?php esc_html_e( 'BIC / SWIFT', 'cofeo' ); ?></label></th>
						<td><input type="text" id="cofeo_bic" name="bic" value="<?php echo esc_attr( $config['bic'] ); ?>" class="regular-text" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="cofeo_instructions"><?php esc_html_e( 'Instructions', 'cofeo' ); ?></label></th>
						<td><textarea id="cofeo_instructions" name="instructions" rows="4" class="large-text"><?php echo esc_textarea( $config['instructions'] ); ?></textarea></td>
					</tr>
				</table>
				<?php submit_button( __( 'Save bank details', 'cofeo' ) ); ?>
			</form>
		</div>
		<?php
	}

	public static function handle_save() {
		check_admin_referer( self::NONCE_ACTION, 'cofeo_bank_transfer_nonce' );
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'cofeo' ) );
		}

		$fields = array();
		foreach ( array( 'account_holder', 'bank_name', 'rib', 'iban', 'bic' ) as $key ) {
			$fields[ $key ] = isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
		}
		$fields['instructions'] = isset( $_POST['instructions'] ) ? sanitize_textarea_field( wp_unslash( $_POST['instructions'] ) ) : '';

		Cofeo_Bank_Transfer_Settings::update( $fields );

		wp_safe_redirect( add_query_arg( 'cofeo_notice', 'saved', admin_url( 'admin.php?page=' . self::PAGE_SLUG ) ) );
		exit;
	}
}

add_action( 'admin_menu', array( 'Cofeo_Bank_Transfer_Admin', 'register_menu' ) );
add_action( 'admin_post_cofeo_save_bank_transfer_details', array( 'Cofeo_Bank_Transfer_Admin', 'handle_save' ) );
