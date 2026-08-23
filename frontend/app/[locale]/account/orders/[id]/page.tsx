import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { OrderDetailView } from "@/components/account/order-detail-view";
import { getSession } from "@/lib/auth/session";
import { assertCustomerOwnsOrder } from "@/lib/auth/order-ownership";
import { getOrderById } from "@/lib/woocommerce/order";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });

  return {
    title: `${t("orderDetailsHeading", { number: id })} — COFEO`,
    robots: { index: false },
  };
}

/**
 * Ownership is enforced here, server-side, before any order data is
 * ever handed to the client. `getOrderById` fetches by id alone (no
 * `order_key` — this route's access control comes from the session,
 * not a query-string secret, unlike the public /order-confirmation
 * flow); `assertCustomerOwnsOrder` then compares the order's real
 * `customer_id` against the authenticated session's own
 * `wooCustomerId`. A nonexistent order, someone else's order, and no
 * session at all all end the same way — `notFound()` — deliberately
 * never distinguishing "doesn't exist" from "exists but isn't yours",
 * the same posture `getOrderByKey` already uses for the public
 * confirmation flow. Changing the `[id]` in the URL to another
 * customer's real order number cannot bypass this: the id only
 * selects *which* order is fetched, never *whether* the caller may
 * see it.
 */
export default async function AccountOrderDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const order = await getOrderById(orderId);
  if (!order) {
    notFound();
  }

  try {
    assertCustomerOwnsOrder(session, order.customerId);
  } catch {
    notFound();
  }

  return (
    <Section>
      <Container className="max-w-2xl">
        <OrderDetailView order={order} />
      </Container>
    </Section>
  );
}
