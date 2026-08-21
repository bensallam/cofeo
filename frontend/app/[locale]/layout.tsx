import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { MotionProvider } from "@/components/providers/motion-provider";
import { SkipLink } from "@/components/ui/skip-link";
import { Header } from "@/components/homepage/header";
import { Footer } from "@/components/homepage/footer";
import "../globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "COFEO",
  description: "Selected. Tested. Transparent. Professional.",
};

const RTL_LOCALES = new Set(["ar"]);

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale's server components.
  setRequestLocale(locale);

  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  const t = await getTranslations("Nav");

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${plexSans.variable} ${plexSansArabic.variable}`}
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <MotionProvider>
            <SkipLink label={t("skipToContent")} targetId="main-content" />
            <Header />
            <main id="main-content">{children}</main>
            <Footer />
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
