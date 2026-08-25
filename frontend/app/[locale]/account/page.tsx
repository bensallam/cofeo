import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth-actions";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth.account" });

  return {
    title: `${t("heading")} — COFEO`,
    alternates: {
      canonical: `/${locale}/account`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/account`])),
    },
    robots: { index: false },
  };
}

/**
 * The real security boundary for this route — checked here, in the
 * page itself, not only (or even primarily) via middleware. Next.js's
 * own guidance is that a redirect at the proxy/middleware layer is a
 * UX nicety, not a substitute for verifying access where the protected
 * content is actually rendered; `getSession()` here is what a customer
 * genuinely cannot bypass by, say, requesting the page a different way.
 */
export default async function AccountPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Auth.account");
  const tAuth = await getTranslations("Auth");
  const boundLogout = logoutAction.bind(null, locale as Locale);

  return (
    <Section>
      <Container className="max-w-md">
        <div className="flex flex-col gap-6 rounded-(--radius-card) border border-border bg-surface p-8">
          <div className="flex flex-col gap-1.5">
            <Heading level={1} size="l">
              {t("greeting", { name: session.firstName || session.email })}
            </Heading>
            <p className="text-body text-text-secondary">{t("heading")}</p>
          </div>

          <Link
            href="/account/orders"
            className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-border-strong p-4 transition-colors duration-200 hover:bg-surface-hover"
          >
            <span className="flex items-center gap-2 text-body-s font-medium text-text-primary">
              <span aria-hidden="true">📦</span>
              {t("myOrders")}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-4 text-text-muted rtl:-scale-x-100"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/account/loyalty"
            className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-border-strong p-4 transition-colors duration-200 hover:bg-surface-hover"
          >
            <span className="flex items-center gap-2 text-body-s font-medium text-text-primary">
              <span aria-hidden="true">⭐</span>
              {t("loyaltyCta")}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-4 text-text-muted rtl:-scale-x-100"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </Link>

          <div
            className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-border-strong p-4 opacity-60"
            aria-disabled="true"
          >
            <span className="flex items-center gap-2 text-body-s font-medium text-text-primary">
              <span aria-hidden="true">👤</span>
              {t("myInfo")}
            </span>
            <span className="text-caption text-text-muted">{t("comingSoon")}</span>
          </div>

          <form action={boundLogout}>
            <button
              type="submit"
              className="w-full rounded-xl border border-button-secondary-border bg-button-secondary-bg py-3 text-body-s font-medium text-button-secondary-text transition-colors duration-200 hover:bg-surface-hover"
            >
              {tAuth("logoutButton")}
            </button>
          </form>
        </div>
      </Container>
    </Section>
  );
}
