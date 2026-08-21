import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCurrentCart } from "@/lib/cart/current-cart";
import { getShippingCities } from "@/lib/woocommerce/shipping-cities";
import { filterCheckoutCities } from "@/lib/checkout/checkout-city-display";
import { getAvailablePaymentMethods } from "@/lib/checkout/current-payment-methods";
import { getBankTransferDetails } from "@/lib/woocommerce/bank-transfer";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });

  return {
    title: `${t("heading")} — COFEO`,
    alternates: {
      canonical: `/${locale}/checkout`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/checkout`])),
    },
    robots: { index: false },
  };
}

export default async function CheckoutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Checkout");
  const [cart, allCities, paymentMethods, bankTransferDetails] = await Promise.all([
    getCurrentCart(),
    getShippingCities(),
    getAvailablePaymentMethods(),
    getBankTransferDetails(),
  ]);
  const cities = filterCheckoutCities(allCities);

  return (
    <Section>
      <Container>
        <Link
          href="/machines"
          className="mb-4 inline-flex items-center gap-1.5 text-body-s text-text-secondary transition-colors duration-200 hover:text-text-primary"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-3.5 rtl:-scale-x-100"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 5-7 7 7 7" />
          </svg>
          {t("backToCatalogue")}
        </Link>

        <Heading level={1} size="xl" className="mb-8">
          {t("heading")}
        </Heading>

        {cart.items.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Button variant="secondary" href="/machines">
                {t("backToCatalogue")}
              </Button>
            }
          />
        ) : (
          <CheckoutForm
            cities={cities}
            initialCart={cart}
            paymentMethods={paymentMethods}
            bankTransferDetails={bankTransferDetails}
          />
        )}
      </Container>
    </Section>
  );
}
