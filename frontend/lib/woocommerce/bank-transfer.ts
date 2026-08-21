import { serverEnv } from "@/config/env";

/**
 * Reads the bank-transfer display details from the custom COFEO
 * plugin's own public REST namespace (cofeo/v1) — deliberately not
 * wc/v3, no credentials. Server-only: fetched fresh per request, never
 * a NEXT_PUBLIC_* value or a build-time constant. The endpoint itself
 * returns every field empty and `enabled: false` unless the
 * cofeo_bank_transfer gateway is actually enabled server-side, so this
 * function never needs to guess or hide anything on the frontend.
 */
export type BankTransferDetails = {
  enabled: boolean;
  accountHolder: string;
  bankName: string;
  rib: string;
  iban: string;
  bic: string;
  instructions: string;
};

type StoreBankTransferResponse = {
  enabled: boolean;
  account_holder: string;
  bank_name: string;
  rib: string;
  iban: string;
  bic: string;
  instructions: string;
};

const EMPTY_BANK_TRANSFER_DETAILS: BankTransferDetails = {
  enabled: false,
  accountHolder: "",
  bankName: "",
  rib: "",
  iban: "",
  bic: "",
  instructions: "",
};

/**
 * Fails closed to "disabled, no details" rather than throwing — this is
 * supplementary checkout-page data (the payment method itself is only
 * ever offered once Store API's own `payment_methods` includes it), so
 * a transient WordPress error here should never break the checkout page
 * render, the same posture as getAvailablePaymentMethods().
 */
export async function getBankTransferDetails(): Promise<BankTransferDetails> {
  const url = new URL("/wp-json/cofeo/v1/bank-transfer", serverEnv.WORDPRESS_API_URL);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return EMPTY_BANK_TRANSFER_DETAILS;
    }

    const data = (await response.json()) as StoreBankTransferResponse;
    return {
      enabled: data.enabled,
      accountHolder: data.account_holder,
      bankName: data.bank_name,
      rib: data.rib,
      iban: data.iban,
      bic: data.bic,
      instructions: data.instructions,
    };
  } catch {
    return EMPTY_BANK_TRANSFER_DETAILS;
  }
}
