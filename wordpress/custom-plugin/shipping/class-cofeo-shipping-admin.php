<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * COFEO Shipping admin page — view/search the 330-city master list,
 * change the default rate, override a specific city's rate, and restore
 * a city to the default. Every mutation is nonce- and capability-
 * checked (manage_woocommerce) via the standard admin-post.php pattern.
 * City labels themselves are never editable here — only rates.
 */
class Cofeo_Shipping_Admin {

	const NONCE_ACTION = 'cofeo_shipping_admin';
	const CAPABILITY   = 'manage_woocommerce';
	const PAGE_SLUG    = 'cofeo-shipping';

	public static function register_menu() {
		add_submenu_page(
			'woocommerce',
			__( 'COFEO Shipping', 'cofeo' ),
			__( 'COFEO Shipping', 'cofeo' ),
			self::CAPABILITY,
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);
	}

	private static function minor_to_major_str( $minor_units ) {
		if ( $minor_units === null ) {
			return '';
		}
		$decimals = wc_get_price_decimals();
		return number_format( $minor_units / ( 10 ** $decimals ), $decimals, '.', '' );
	}

	private static function major_str_to_minor( $major_str ) {
		$decimals = wc_get_price_decimals();
		$value    = (float) wp_unslash( $major_str );
		return (int) round( $value * ( 10 ** $decimals ) );
	}

	public static function render_page() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'cofeo' ) );
		}

		$cities         = Cofeo_Shipping_Cities::get_all();
		$config         = Cofeo_Shipping_Rates::get_config();
		$default_minor  = $config['default'];
		$overrides      = $config['overrides'];
		$notice         = isset( $_GET['cofeo_notice'] ) ? sanitize_key( wp_unslash( $_GET['cofeo_notice'] ) ) : '';
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'COFEO Shipping', 'cofeo' ); ?></h1>

			<?php if ( $notice === 'default_saved' ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Default rate updated.', 'cofeo' ); ?></p></div>
			<?php elseif ( $notice === 'override_saved' ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'City override saved.', 'cofeo' ); ?></p></div>
			<?php elseif ( $notice === 'override_restored' ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'City restored to default rate.', 'cofeo' ); ?></p></div>
			<?php elseif ( $notice === 'invalid_city' ) : ?>
				<div class="notice notice-error is-dismissible"><p><?php esc_html_e( 'That city is not in the master list — no change was made.', 'cofeo' ); ?></p></div>
			<?php endif; ?>

			<?php if ( $default_minor === null ) : ?>
				<div class="notice notice-warning"><p>
					<?php esc_html_e( 'No shipping configuration exists yet. Set a default rate below to initialize it.', 'cofeo' ); ?>
				</p></div>
			<?php endif; ?>

			<h2><?php esc_html_e( 'Default rate', 'cofeo' ); ?></h2>
			<p><?php esc_html_e( 'Applied to every city in the master list that does not have its own override below.', 'cofeo' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( self::NONCE_ACTION, 'cofeo_shipping_nonce' ); ?>
				<input type="hidden" name="action" value="cofeo_set_default_rate" />
				<input type="number" step="0.01" min="0" name="cofeo_rate" value="<?php echo esc_attr( self::minor_to_major_str( $default_minor ) ); ?>" style="width:120px;" />
				<span>MAD</span>
				<?php submit_button( __( 'Save default rate', 'cofeo' ), 'primary', '', false ); ?>
			</form>

			<h2 style="margin-top:2em;"><?php esc_html_e( 'Cities', 'cofeo' ); ?> (<?php echo esc_html( count( $cities ) ); ?>)</h2>
			<p>
				<input type="text" id="cofeo-city-search" placeholder="<?php esc_attr_e( 'Search cities…', 'cofeo' ); ?>" style="width:300px;" />
			</p>

			<table class="widefat striped" id="cofeo-city-table">
				<thead>
					<tr>
						<th><?php esc_html_e( 'City', 'cofeo' ); ?></th>
						<th><?php esc_html_e( 'Effective rate', 'cofeo' ); ?></th>
						<th><?php esc_html_e( 'Status', 'cofeo' ); ?></th>
						<th><?php esc_html_e( 'Set rate', 'cofeo' ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $cities as $city ) :
						$is_override    = array_key_exists( $city, $overrides );
						$effective_minor = $is_override ? $overrides[ $city ] : $default_minor;
						?>
						<tr data-city-name="<?php echo esc_attr( strtolower( $city ) ); ?>">
							<td><?php echo esc_html( $city ); ?></td>
							<td><?php echo esc_html( self::minor_to_major_str( $effective_minor ) ); ?> MAD</td>
							<td>
								<?php if ( $is_override ) : ?>
									<strong style="color:#b32d2e;"><?php esc_html_e( 'Overridden', 'cofeo' ); ?></strong>
								<?php else : ?>
									<span style="color:#666;"><?php esc_html_e( 'Default', 'cofeo' ); ?></span>
								<?php endif; ?>
							</td>
							<td>
								<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline-flex; gap:6px; align-items:center;">
									<?php wp_nonce_field( self::NONCE_ACTION, 'cofeo_shipping_nonce' ); ?>
									<input type="hidden" name="cofeo_city" value="<?php echo esc_attr( $city ); ?>" />
									<input type="number" step="0.01" min="0" name="cofeo_rate" value="<?php echo esc_attr( self::minor_to_major_str( $effective_minor ) ); ?>" style="width:90px;" />
									<button type="submit" name="action" value="cofeo_set_city_override" class="button">
										<?php esc_html_e( 'Save', 'cofeo' ); ?>
									</button>
									<?php if ( $is_override ) : ?>
										<button type="submit" name="action" value="cofeo_restore_city_default" class="button-link">
											<?php esc_html_e( 'Restore default', 'cofeo' ); ?>
										</button>
									<?php endif; ?>
								</form>
							</td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<script>
		(function () {
			var input = document.getElementById('cofeo-city-search');
			var rows = document.querySelectorAll('#cofeo-city-table tbody tr');
			input.addEventListener('input', function () {
				var term = input.value.trim().toLowerCase();
				rows.forEach(function (row) {
					var match = row.getAttribute('data-city-name').indexOf(term) !== -1;
					row.style.display = match ? '' : 'none';
				});
			});
		})();
		</script>
		<?php
	}

	public static function handle_set_default_rate() {
		check_admin_referer( self::NONCE_ACTION, 'cofeo_shipping_nonce' );
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'cofeo' ) );
		}

		$rate = isset( $_POST['cofeo_rate'] ) ? self::major_str_to_minor( $_POST['cofeo_rate'] ) : 0;
		Cofeo_Shipping_Rates::set_default( $rate );

		wp_safe_redirect( add_query_arg( 'cofeo_notice', 'default_saved', admin_url( 'admin.php?page=' . self::PAGE_SLUG ) ) );
		exit;
	}

	public static function handle_set_city_override() {
		check_admin_referer( self::NONCE_ACTION, 'cofeo_shipping_nonce' );
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'cofeo' ) );
		}

		$city = isset( $_POST['cofeo_city'] ) ? sanitize_text_field( wp_unslash( $_POST['cofeo_city'] ) ) : '';
		$rate = isset( $_POST['cofeo_rate'] ) ? self::major_str_to_minor( $_POST['cofeo_rate'] ) : 0;

		$ok     = Cofeo_Shipping_Rates::set_override( $city, $rate );
		$notice = $ok ? 'override_saved' : 'invalid_city';

		wp_safe_redirect( add_query_arg( 'cofeo_notice', $notice, admin_url( 'admin.php?page=' . self::PAGE_SLUG ) ) );
		exit;
	}

	public static function handle_restore_city_default() {
		check_admin_referer( self::NONCE_ACTION, 'cofeo_shipping_nonce' );
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'cofeo' ) );
		}

		$city = isset( $_POST['cofeo_city'] ) ? sanitize_text_field( wp_unslash( $_POST['cofeo_city'] ) ) : '';
		Cofeo_Shipping_Rates::restore_default( $city );

		wp_safe_redirect( add_query_arg( 'cofeo_notice', 'override_restored', admin_url( 'admin.php?page=' . self::PAGE_SLUG ) ) );
		exit;
	}
}

add_action( 'admin_menu', array( 'Cofeo_Shipping_Admin', 'register_menu' ) );
add_action( 'admin_post_cofeo_set_default_rate', array( 'Cofeo_Shipping_Admin', 'handle_set_default_rate' ) );
add_action( 'admin_post_cofeo_set_city_override', array( 'Cofeo_Shipping_Admin', 'handle_set_city_override' ) );
add_action( 'admin_post_cofeo_restore_city_default', array( 'Cofeo_Shipping_Admin', 'handle_restore_city_default' ) );
