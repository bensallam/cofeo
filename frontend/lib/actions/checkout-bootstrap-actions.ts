"use server";

import { getShippingCities } from "@/lib/woocommerce/shipping-cities";
import { filterCheckoutCities } from "@/lib/checkout/checkout-city-display";
import { getAvailablePaymentMethods } from "@/lib/checkout/current-payment-methods";
import { getBankTransferDetails, type BankTransferDetails } from "@/lib/woocommerce/bank-transfer";

export type CheckoutBootstrap = {
  cities: string[];
  paymentMethods: string[];
  bankTransferDetails: BankTransferDetails;
};

/**
 * The same site-config lookups /[locale]/checkout already does server-side
 * on every visit (shipping cities, active payment methods, bank-transfer
 * details) — repackaged as a Server Action so the Buy Now flow on the
 * product page can fetch them on demand, only when a customer actually
 * opens the checkout modal, instead of paying this cost on every product
 * page view. The cart itself isn't fetched here: Buy Now already has the
 * authoritative post-add cart from addToCartAction's own result.
 */
export async function getCheckoutBootstrapAction(): Promise<CheckoutBootstrap> {
  const [allCities, paymentMethods, bankTransferDetails] = await Promise.all([
    getShippingCities(),
    getAvailablePaymentMethods(),
    getBankTransferDetails(),
  ]);

  return {
    cities: filterCheckoutCities(allCities),
    paymentMethods,
    bankTransferDetails,
  };
}
