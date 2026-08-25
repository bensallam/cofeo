import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoyaltyTransactionRow } from "@/components/account/loyalty-transaction-row";
import { getSession } from "@/lib/auth/session";
import { getLoyaltySummaryForCustomer } from "@/lib/woocommerce/loyalty";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Loyalty" });

  return {
    title: `${t("heading")} — COFEO`,
    alternates: {
      canonical: `/${locale}/account/loyalty`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/account/loyalty`])),
    },
    robots: { index: false },
  };
}

/**
 * Protected the same way every other /account page is (Phase 3A):
 * checked here, in the page itself. The summary is fetched scoped to
 * `session.wooCustomerId` via `getLoyaltySummaryForCustomer` — never a
 * client-supplied id, exactly the same rule /account/orders already
 * follows for `getOrdersByCustomerId`.
 */
export default async function AccountLoyaltyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Loyalty");
  const summary = await getLoyaltySummaryForCustomer(session.wooCustomerId);

  return (
    <Section>
      <Container className="max-w-2xl">
        <Heading level={1} size="xl" className="mb-8">
          {t("heading")}
        </Heading>

        <Card className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SummaryStat label={t("balanceLabel")} value={summary.balance} emphasized />
          <SummaryStat label={t("totalEarnedLabel")} value={summary.totalEarned} />
          <SummaryStat label={t("totalReversedLabel")} value={summary.totalReversed} />
        </Card>

        <Heading level={2} size="l" className="mb-4">
          {t("historyHeading")}
        </Heading>

        {summary.transactions.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <div className="flex flex-col gap-3">
            {summary.transactions.map((transaction) => (
              <LoyaltyTransactionRow
                key={`${transaction.orderId}-${transaction.episode}-${transaction.type}`}
                transaction={transaction}
              />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

function SummaryStat({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-text-muted">{label}</span>
      <span className={`tabular-nums text-text-primary ${emphasized ? "text-price-lg font-semibold" : "text-body-l font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
