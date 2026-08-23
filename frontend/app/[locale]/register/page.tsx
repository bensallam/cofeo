import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { RegisterForm } from "@/components/auth/register-form";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: `${t("registerTitle")} — COFEO`,
    alternates: {
      canonical: `/${locale}/register`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/register`])),
    },
    robots: { index: false },
  };
}

export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Section>
      <Container className="max-w-md">
        <div className="rounded-(--radius-card) border border-border bg-surface p-8">
          <RegisterForm />
        </div>
      </Container>
    </Section>
  );
}
