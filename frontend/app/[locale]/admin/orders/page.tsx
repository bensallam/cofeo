import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AdminOrderListRow } from "@/components/admin/admin-order-list-row";
import { getSession } from "@/lib/auth/session";
import { getOrdersForAdmin } from "@/lib/woocommerce/order";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });

  return {
    title: `${t("ordersHeading")} — COFEO`,
    robots: { index: false },
  };
}

/**
 * ADMIN-only order list — the COFEO-native counterpart to wp-admin's
 * own order list, reusing the same `getSession()`/role check
 * `lib/actions/admin-order-actions.ts` already uses for the mutation
 * itself (Phase 4D). Two different denial postures, deliberately: no
 * session at all redirects to /login (a normal, helpful outcome —
 * there is nothing sensitive to hide from an anonymous visitor being
 * asked to sign in); a real session that simply isn't ADMIN gets
 * `notFound()` instead, the same "never confirm what exists" posture
 * `assertCustomerOwnsOrder` already uses for a customer's own orders —
 * a logged-in customer has no reason to be told an admin area exists
 * at all.
 *
 * `getOrdersForAdmin()` itself performs no authorization — this page
 * is the only thing standing between it and anyone who can reach this
 * route, exactly like `getOrderById` relies entirely on its own
 * caller for ownership checks.
 */
export default async function AdminOrdersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }
  if (session.role !== "ADMIN") {
    notFound();
  }

  const { page: pageParam } = await searchParams;
  const page = Number(pageParam);
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;

  const t = await getTranslations("Admin");
  const { orders, hasNextPage } = await getOrdersForAdmin({ page: currentPage });

  return (
    <Section>
      <Container className="max-w-2xl">
        <Heading level={1} size="xl" className="mb-8">
          {t("ordersHeading")}
        </Heading>

        {orders.length === 0 ? (
          <EmptyState title={t("noOrdersTitle")} />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {orders.map((order) => (
                <AdminOrderListRow key={order.orderId} order={order} />
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between gap-3">
              {currentPage > 1 ? (
                <Button variant="secondary" href={`/admin/orders?page=${currentPage - 1}`}>
                  {t("previousPage")}
                </Button>
              ) : (
                <span />
              )}
              {hasNextPage && (
                <Button variant="secondary" href={`/admin/orders?page=${currentPage + 1}`}>
                  {t("nextPage")}
                </Button>
              )}
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
