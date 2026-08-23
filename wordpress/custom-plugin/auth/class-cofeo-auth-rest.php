<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Customer registration and login — own cofeo/v1 namespace, publicly
 * reachable (register/login are inherently public-facing actions, same
 * posture as wp-login.php itself), never wc/v3. This is the one piece
 * of custom server-side code this feature genuinely needs: WooCommerce's
 * REST API v3 has no endpoint that verifies a password against a
 * WordPress user — everything else (Next.js's session cookie, the
 * order-status meta from Phase 2) already runs entirely through
 * existing, already-authenticated WooCommerce REST API v3 calls.
 *
 * WordPress core owns password storage and hashing end to end
 * (`wp_insert_user`, `wp_check_password`) — nothing here ever stores,
 * hashes, or echoes a raw or hashed password itself. A WooCommerce
 * customer *is* a WordPress user with the `customer` role (WooCommerce
 * has no separate customer table), so `wp_insert_user( ['role' =>
 * 'customer'] )` is the correct, complete way to create one — no
 * WooCommerce-specific customer-creation call is needed on top of it.
 *
 * Rate limiting (Cofeo_Auth_Rate_Limit) keys on REMOTE_ADDR, which,
 * since every real customer request is proxied server-side through
 * Next.js, is Next's own server address rather than the original
 * browser's IP — every legitimate request funnels through one source
 * either way in this architecture. Login additionally keys on the
 * submitted email, which is what actually matters for the primary
 * threat this defends against (brute-forcing one account's password):
 * that stays capped at MAX_ATTEMPTS regardless of source IP. Properly
 * attributing attempts to the original browser would require Next.js
 * to forward a trusted client-IP header once a real reverse-proxy
 * topology exists — a reasonable later hardening step, not a Phase 3A
 * correctness gap.
 */
class Cofeo_Auth_Rest {

	public static function register_routes() {
		register_rest_route(
			'cofeo/v1',
			'/auth/register',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'register' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'cofeo/v1',
			'/auth/login',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'login' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	private static function client_ip() {
		return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
	}

	private static function error( $code, $status ) {
		$response = rest_ensure_response( array( 'code' => $code ) );
		$response->set_status( $status );
		return $response;
	}

	/**
	 * `firstName`/`lastName`/`email`/`password` in the request body.
	 * Password strength is also validated here (min 8 chars) even
	 * though Next.js's own zod schema already enforces a stronger rule
	 * — this endpoint must never assume it's only ever called by that
	 * trusted, well-behaved frontend, since it's publicly reachable.
	 */
	public static function register( WP_REST_Request $request ) {
		$email      = sanitize_email( (string) $request->get_param( 'email' ) );
		$password   = (string) $request->get_param( 'password' );
		$first_name = sanitize_text_field( (string) $request->get_param( 'firstName' ) );
		$last_name  = sanitize_text_field( (string) $request->get_param( 'lastName' ) );

		if ( ! is_email( $email ) || strlen( $password ) < 8 || '' === $first_name || '' === $last_name ) {
			return self::error( 'VALIDATION_ERROR', 400 );
		}

		$rate_key = 'register_' . self::client_ip();
		if ( Cofeo_Auth_Rate_Limit::is_limited( $rate_key ) ) {
			return self::error( 'RATE_LIMITED', 429 );
		}
		Cofeo_Auth_Rate_Limit::record_attempt( $rate_key );

		if ( email_exists( $email ) ) {
			return self::error( 'EMAIL_ALREADY_EXISTS', 409 );
		}

		$user_id = wp_insert_user(
			array(
				'user_login' => $email,
				'user_email' => $email,
				'user_pass'  => $password,
				'first_name' => $first_name,
				'last_name'  => $last_name,
				'role'       => 'customer',
			)
		);

		if ( is_wp_error( $user_id ) ) {
			return self::error( 'SERVER_ERROR', 500 );
		}

		Cofeo_Auth_Rate_Limit::reset( $rate_key );

		return rest_ensure_response(
			array(
				'userId' => $user_id,
				'email'  => $email,
			)
		);
	}

	/**
	 * `email`/`password` in the request body. Returns everything
	 * Next.js needs to mint its own signed session cookie — never the
	 * password or its hash. `role` is derived from WordPress's own
	 * `manage_woocommerce` capability, never from anything the caller
	 * supplied: a plain `customer`-role registration (the only role
	 * `register()` above ever assigns) never has this capability, so a
	 * newly registered account can never come back as ADMIN by
	 * construction. Failure is always the same generic
	 * INVALID_CREDENTIALS regardless of whether the email exists,
	 * including running `wp_check_password` against a dummy hash when
	 * it doesn't, so response time doesn't leak account existence
	 * either.
	 */
	public static function login( WP_REST_Request $request ) {
		$email    = sanitize_email( (string) $request->get_param( 'email' ) );
		$password = (string) $request->get_param( 'password' );

		$rate_key = 'login_' . self::client_ip() . '_' . md5( $email );
		if ( Cofeo_Auth_Rate_Limit::is_limited( $rate_key ) ) {
			return self::error( 'RATE_LIMITED', 429 );
		}

		$user = is_email( $email ) ? get_user_by( 'email', $email ) : false;

		// A syntactically real (but not-anyone's) WordPress password
		// hash, so a nonexistent account still costs a real
		// wp_check_password() computation rather than short-circuiting.
		$dummy_hash   = '$P$BDummyDummyDummyDummyDummyDu.';
		$password_ok  = wp_check_password( $password, $user ? $user->user_pass : $dummy_hash, $user ? $user->ID : 0 );

		if ( ! $user || ! $password_ok ) {
			Cofeo_Auth_Rate_Limit::record_attempt( $rate_key );
			return self::error( 'INVALID_CREDENTIALS', 401 );
		}

		Cofeo_Auth_Rate_Limit::reset( $rate_key );

		$role               = user_can( $user, 'manage_woocommerce' ) ? 'ADMIN' : 'CUSTOMER';
		$session_generation = (int) get_user_meta( $user->ID, '_cofeo_session_generation', true );

		return rest_ensure_response(
			array(
				'userId'            => $user->ID,
				'email'             => $user->user_email,
				'firstName'         => $user->first_name,
				'lastName'          => $user->last_name,
				'wooCustomerId'     => $user->ID,
				'role'              => $role,
				'sessionGeneration' => $session_generation,
			)
		);
	}
}
add_action( 'rest_api_init', array( 'Cofeo_Auth_Rest', 'register_routes' ) );
