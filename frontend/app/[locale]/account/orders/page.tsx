import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { OrderListCard } from "@/components/account/order-list-card";
import { getSession } from "@/lib/auth/session";
import { getOrdersByCustomerId } from "@/lib/woocommerce/order";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });

  return {
    title: `${t("ordersHeading")} — COFEO`,
    alternates: {
      canonical: `/${locale}/account/orders`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/account/orders`])),
    },
    robots: { index: false },
  };
}

/**
 * Protected the same way /account is (Phase 3A): checked here, in the
 * page itself. Orders are fetched scoped to `session.wooCustomerId`
 * via `getOrdersByCustomerId` — never the full order list filtered
 * client-side.
 */
export default async function AccountOrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Account");
  const orders = await getOrdersByCustomerId(session.wooCustomerId);

  return (
    <Section>
      <Container className="max-w-2xl">
        <Heading level={1} size="xl" className="mb-8">
          {t("ordersHeading")}
        </Heading>

        {orders.length === 0 ? (
          <EmptyState
            title={t("noOrdersTitle")}
            action={
              <Button variant="secondary" href="/machines">
                {t("noOrdersCta")}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <OrderListCard key={order.orderId} order={order} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
