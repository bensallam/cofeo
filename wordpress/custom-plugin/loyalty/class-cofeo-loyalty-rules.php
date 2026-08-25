<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Phase 4E — the ONE place COFEO's loyalty economics live. No other
 * file in this codebase (WordPress or Next.js) may hard-code a points
 * ratio, an earning base, or an eligibility rule; every one of those
 * decisions is reached exclusively through this class, exactly as the
 * Phase 4E audit required ("centralized behind one clearly isolated
 * business-rule/configuration function").
 *
 * ============================================================
 * PROVISIONAL VALUES — NOT AN APPROVED BUSINESS DECISION
 * ============================================================
 * The repository contains no defined points-per-currency ratio,
 * earning base, minimum order amount, product/category exclusions, or
 * expiry policy (see the Phase 4E read-only audit). `POINTS_PER_MAD`
 * and `calculate_earning_base()` below are a clearly-labeled
 * placeholder — 1 point per 1 MAD of the order's line-item subtotal
 * (post-discount, pre-shipping, pre-tax) — chosen only so the ledger
 * mechanics (earning, reversal, re-earning, concurrency) are
 * end-to-end testable. Changing the real ratio or earning base later
 * requires editing only this file; nothing else references the
 * numbers, only this class's public methods.
 */
class Cofeo_Loyalty_Rules {

	/** PROVISIONAL — see class docblock. */
	const POINTS_PER_MAD = 1;

	/**
	 * PROVISIONAL earning base: the sum of each line item's own
	 * `get_total()` (WooCommerce's post-discount, pre-tax per-item
	 * total) — deliberately excludes shipping (`get_shipping_total()`)
	 * and tax (`get_total_tax()`), on the reasoning that a customer
	 * shouldn't earn points on what they paid to have the order
	 * delivered or in tax, only on the goods themselves. This is a
	 * placeholder rule, not an approved one — see class docblock.
	 */
	private static function calculate_earning_base( $order ) {
		$subtotal = 0.0;
		foreach ( $order->get_items() as $item ) {
			$subtotal += (float) $item->get_total();
		}
		return max( 0.0, $subtotal );
	}

	/**
	 * Whole points only — the ledger table's `points` column is
	 * INT UNSIGNED (class-cofeo-loyalty-schema.php); fractional points
	 * are never stored. Never negative: `max(0.0, ...)` in
	 * calculate_earning_base() already guards the base itself, and
	 * `floor()` of a non-negative number is never negative either.
	 */
	public static function calculate_points_for_order( $order ) {
		$earning_base = self::calculate_earning_base( $order );
		return (int) floor( $earning_base * self::POINTS_PER_MAD );
	}

	/**
	 * The one configurable trigger point for earning — DELIVERED, per
	 * the Phase 4E business principle ("prefer a business-safe event
	 * such as DELIVERED"). `$old_cofeo`/`$new_cofeo` are COFEO status
	 * keys (NEW/CONFIRMED/PREPARING/SHIPPED/OUT_FOR_DELIVERY/DELIVERED/
	 * CANCELLED) already resolved by the caller — this function makes
	 * no WooCommerce API calls itself, purely a rule over two strings,
	 * so it's trivially unit-testable without any WordPress bootstrap.
	 */
	public static function is_earning_trigger( $old_cofeo, $new_cofeo ) {
		return 'DELIVERED' === $new_cofeo && 'DELIVERED' !== $old_cofeo;
	}

	/**
	 * Reversal fires on ANY move away from DELIVERED, not only a move
	 * to CANCELLED — Phase 4D already lets an ADMIN correct DELIVERED
	 * back to an earlier status (e.g. DELIVERED -> PREPARING, proven
	 * live in that phase's own verification), and the earning
	 * precondition ("this order was actually delivered") stops holding
	 * the moment that correction happens, regardless of which status
	 * it lands on.
	 */
	public static function is_reversal_trigger( $old_cofeo, $new_cofeo ) {
		return 'DELIVERED' === $old_cofeo && 'DELIVERED' !== $new_cofeo;
	}
}
