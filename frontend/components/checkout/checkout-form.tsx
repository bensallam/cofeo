"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CityCombobox } from "@/components/checkout/city-combobox";
import { PhoneInput } from "@/components/checkout/phone-input";
import { OrderReview } from "@/components/checkout/order-review";
import { PaymentSection } from "@/components/checkout/payment-section";
import { TrustSection } from "@/components/checkout/trust-section";
import { updateCheckoutCityAction, placeOrderAction } from "@/lib/actions/checkout-actions";
import { placeOrderInputSchema } from "@/lib/validation/checkout";
import type { Cart } from "@/lib/woocommerce/cart-types";
import type { BankTransferDetails } from "@/lib/woocommerce/bank-transfer";
import type { ErrorCode } from "@/lib/errors/app-error";
import type { Locale } from "@/i18n/routing";

type CheckoutFormProps = {
  cities: string[];
  initialCart: Cart;
  paymentMethods: string[];
  bankTransferDetails: BankTransferDetails;
};

type FieldErrors = Partial<
  Record<"fullName" | "email" | "phone" | "city" | "address1" | "paymentMethod", string>
>;

// Explicit ids (rather than each field's own auto-generated one) purely
// so a failed submit can focus the first invalid field — visual order
// on the page, which is also validation priority here.
const FIELD_IDS = {
  fullName: "checkout-full-name",
  phone: "checkout-phone",
  city: "checkout-city",
  address1: "checkout-address1",
} as const;
const FIELD_ORDER = ["fullName", "phone", "city", "address1"] as const;

/**
 * City selection auto-triggers a shipping-only update (Phase 8). The
 * rest of the fields, plus payment method, only ever submit together
 * via placeOrderAction — there is no intermediate "save my info" step.
 * Submission is hard-locked while pending (isPlacingOrder) so a
 * double-click can't fire two concurrent placeOrderAction calls from
 * this client; WooCommerce's own draft-order reuse is the server-side
 * backstop (see the Server Action's docblock).
 */
export function CheckoutForm({ cities, initialCart, paymentMethods, bankTransferDetails }: CheckoutFormProps) {
  const t = useTranslations("Checkout");
  const locale = useLocale() as Locale;
  const [cart, setCart] = React.useState(initialCart);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [city, setCity] = React.useState("");
  const [address1, setAddress1] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("");
  const [shippingErrorCode, setShippingErrorCode] = React.useState<ErrorCode | null>(null);
  const [isShippingPending, startShippingTransition] = React.useTransition();
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [orderErrorCode, setOrderErrorCode] = React.useState<ErrorCode | null>(null);
  const [isPlacingOrder, startOrderTransition] = React.useTransition();

  function handleCityChange(nextCity: string) {
    setCity(nextCity);
    setShippingErrorCode(null);
    startShippingTransition(async () => {
      const result = await updateCheckoutCityAction(nextCity);
      if (result.ok) {
        setCart(result.cart);
      } else {
        setShippingErrorCode(result.code);
      }
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPlacingOrder) return;

    const parsed = placeOrderInputSchema.safeParse({
      fullName,
      email,
      phone,
      city,
      address1,
      paymentMethod,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          typeof key === "string" &&
          key in { fullName: 1, email: 1, phone: 1, city: 1, address1: 1, paymentMethod: 1 }
        ) {
          nextErrors[key as keyof FieldErrors] ??= t(`errors.${key}`);
        }
      }
      setFieldErrors(nextErrors);

      // Not just the asterisk/error text — move focus to the first
      // invalid field so keyboard/screen-reader users land right on it.
      const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
      if (firstInvalid) {
        document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      }
      return;
    }

    setFieldErrors({});
    setOrderErrorCode(null);
    startOrderTransition(async () => {
      // On success this call never returns normally — the action itself
      // redirects server-side straight to /order-confirmation (see its
      // own doc comment for why that has to happen there and not here).
      // Only the failure shape is left to handle on this end.
      const result = await placeOrderAction({ ...parsed.data, locale });
      setOrderErrorCode(result.code);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-10">
      {/* Left: customer information + payment — source order also drives
          mobile stacking (info → payment → summary → CTA), no separate
          mobile-only markup needed. */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5 rounded-(--radius-card) border border-border bg-surface/40 p-8 backdrop-blur-xl backdrop-saturate-150">
          <h2 className="text-body-l font-medium text-text-primary">{t("customerInfoHeading")}</h2>
          <div className="flex flex-col gap-4">
            <Input
              id={FIELD_IDS.fullName}
              label={t("fullNameLabel")}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={fieldErrors.fullName}
              autoComplete="name"
              required
            />
            <Input
              label={t("emailLabel")}
              type="email"
              dir="ltr"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              autoComplete="email"
            />
            <PhoneInput
              id={FIELD_IDS.phone}
              label={t("phoneLabel")}
              placeholder={t("phonePlaceholder")}
              value={phone}
              onChange={setPhone}
              error={fieldErrors.phone}
              required
            />
            <CityCombobox
              id={FIELD_IDS.city}
              cities={cities}
              value={city}
              onChange={handleCityChange}
              label={t("cityLabel")}
              hint={t("citySearchHint")}
              moreResultsHint={t("moreCitiesHint")}
              error={fieldErrors.city ?? (shippingErrorCode ? t("errors.city") : undefined)}
              required
            />
            <Textarea
              id={FIELD_IDS.address1}
              label={t("address1Label")}
              value={address1}
              onChange={(event) => setAddress1(event.target.value)}
              error={fieldErrors.address1}
              autoComplete="street-address"
              required
            />
          </div>
        </div>

        <PaymentSection
          paymentMethods={paymentMethods}
          selected={paymentMethod}
          onChange={setPaymentMethod}
          error={fieldErrors.paymentMethod}
          bankTransferDetails={bankTransferDetails}
          amount={cart.total}
          currency={cart.currency}
        />
      </div>

      {/* Right: order summary — the strongest visual element, sticky on
          desktop so the total stays visible while filling in the form. */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-8">
        <OrderReview cart={cart} isShippingPending={isShippingPending} />
        {orderErrorCode && (
          <p role="alert" className="text-body-s text-error">
            {t("errorGeneric")}
          </p>
        )}
        {paymentMethods.length > 0 && (
          <Button
            type="submit"
            variant="primary"
            loading={isPlacingOrder}
            className="w-full rounded-xl py-4 text-body-l"
          >
            {!isPlacingOrder && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-4"
                aria-hidden="true"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 018 0v3" />
              </svg>
            )}
            {t("placeOrderButton")}
          </Button>
        )}
        <TrustSection />
      </div>
    </form>
  );
}
