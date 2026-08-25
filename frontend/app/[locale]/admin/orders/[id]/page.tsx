import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AdminOrderDetailView } from "@/components/admin/admin-order-detail-view";
import { getSession } from "@/lib/auth/session";
import { getOrderById } from "@/lib/woocommerce/order";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });

  return {
    title: `${t("orderDetailsHeading", { number: id })} — COFEO`,
    robots: { index: false },
  };
}

/**
 * ADMIN-only order detail — see app/[locale]/admin/orders/page.tsx for
 * the exact reasoning behind the two-tier denial posture (anonymous →
 * redirect to /login, real-but-non-admin session → notFound()).
 *
 * Deliberately reuses `getOrderById()` as-is: it performs no
 * ownership check by design (see that function's own docblock), which
 * is exactly the property an admin view needs — any real order id
 * resolves, not just ones belonging to the caller. The ADMIN-role
 * check above is what makes that safe; nothing here re-derives or
 * weakens that boundary. Never `getOrderByKey()` (the public,
 * order_key-gated path) — an admin identifies orders by id, not by a
 * customer's own private link.
 */
export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }
  if (session.role !== "ADMIN") {
    notFound();
  }

  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const order = await getOrderById(orderId);
  if (!order) {
    notFound();
  }

  return (
    <Section>
      <Container className="max-w-2xl">
        <AdminOrderDetailView order={order} />
      </Container>
    </Section>
  );
}
