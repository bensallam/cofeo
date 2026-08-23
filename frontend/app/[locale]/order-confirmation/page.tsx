import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import { getOrderByKey } from "@/lib/woocommerce/order";
import { getBankTransferDetails } from "@/lib/woocommerce/bank-transfer";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; key?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout.orderConfirmation" });

  return {
    title: `${t("title")} — COFEO`,
    alternates: {
      canonical: `/${locale}/order-confirmation`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/order-confirmation`])),
    },
    // Per-visitor, key-gated order data — never for search engines.
    robots: { index: false },
  };
}

/**
 * Reached only right after a successful `placeOrderAction` (see
 * CheckoutForm, which redirects here with the real `orderId`/`orderKey`
 * WooCommerce just returned) or by revisiting the same link later —
 * never by guessing: `getOrderByKey` requires the order's own secret
 * `order_key` to match, the same guest-order-access mechanism
 * WooCommerce's own "order received" page relies on. An id without the
 * right key, or no key at all, renders the same 404 as any other
 * unknown route — see that function's own doc comment for why a wrong
 * key isn't distinguished from "no such order."
 */
export default async function OrderConfirmationPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { order: orderParam, key } = await searchParams;
  const orderId = Number(orderParam);

  if (!orderParam || !key || !Number.isInteger(orderId)) {
    notFound();
  }

  const [order, bankTransferDetails] = await Promise.all([
    getOrderByKey(orderId, key),
    getBankTransferDetails(),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <OrderConfirmation order={order} bankTransferDetails={bankTransferDetails} />
      </Container>
    </Section>
  );
}
