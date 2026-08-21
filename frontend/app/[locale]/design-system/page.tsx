import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/i18n/price";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Divider } from "@/components/ui/divider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/components/ui/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  InteractiveFormDemo,
  InteractiveOverlaysDemo,
} from "@/components/design-system-demo/interactive-demo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Internal dev tool — never indexed, never linked from customer-facing pages.
export const metadata: Metadata = {
  title: "COFEO — Design System",
  robots: { index: false, follow: false },
};

// Full literal class names — Tailwind's build-time scanner can't see
// classes assembled via template-literal interpolation (`bg-${token}`),
// so each swatch's class must appear verbatim in source.
const COLOR_SWATCHES = [
  { className: "bg-bg", label: "background" },
  { className: "bg-surface", label: "surface" },
  { className: "bg-text-primary", label: "text-primary" },
  { className: "bg-text-secondary", label: "text-secondary" },
  { className: "bg-text-muted", label: "text-muted" },
  { className: "bg-border", label: "border" },
  { className: "bg-border-strong", label: "border-strong" },
  { className: "bg-success", label: "success" },
  { className: "bg-warning", label: "warning" },
  { className: "bg-error", label: "error" },
] as const;

const SPACING_SWATCHES = [2, 4, 6, 8, 12, 16, 24] as const;

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DesignSystemPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DesignSystem");

  return (
    <main className="bg-bg">
      <Container>
        <Section spacing="sm">
          <Badge variant="warning">{t("devOnlyBadge")}</Badge>
          <Heading level={1} size="display" className="mt-4">
            {t("title")}
          </Heading>
          <p className="mt-2 text-body-l text-text-muted">{t("subtitle")}</p>
        </Section>

        <Divider />

        {/* Typography */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.typography")}
          </Heading>
          <div className="flex flex-col gap-4">
            <p className="text-display text-text-primary">Display — COFEO</p>
            <p className="text-heading-xl text-text-primary">Heading XL — {t("typographySample")}</p>
            <p className="text-heading-l text-text-primary">Heading L — {t("typographySample")}</p>
            <p className="text-heading-m text-text-primary">Heading M — {t("typographySample")}</p>
            <p className="text-heading-s text-text-primary">Heading S — {t("typographySample")}</p>
            <p className="text-body-l text-text-primary">Body Large — {t("typographySample")}</p>
            <p className="text-body text-text-primary">Body — {t("typographySample")}</p>
            <p className="text-body-s text-text-secondary">
              Body Small — {t("typographySample")}
            </p>
            <p className="text-caption tracking-wide text-text-muted uppercase">
              Caption — {t("captionSample")}
            </p>
            <p className="text-price font-semibold text-text-primary tabular-nums">
              Price — {formatPrice(1249, locale as Locale)}
            </p>
          </div>
        </Section>

        <Divider />

        {/* Colors */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.colors")}
          </Heading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {COLOR_SWATCHES.map((swatch) => (
              <div key={swatch.className} className="flex flex-col gap-2">
                <div
                  className={`h-16 rounded-(--radius-card) border border-border ${swatch.className}`}
                />
                <span className="text-caption text-text-muted">{swatch.label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Divider />

        {/* Spacing */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.spacing")}
          </Heading>
          <div className="flex flex-col gap-3">
            {SPACING_SWATCHES.map((step) => (
              <div key={step} className="flex items-center gap-4">
                <span className="w-12 text-caption text-text-muted">{step * 4}px</span>
                <div className="bg-text-primary" style={{ width: step * 4, height: 12 }} />
              </div>
            ))}
          </div>
        </Section>

        <Divider />

        {/* Buttons */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.buttons")}
          </Heading>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">{t("buttons.primary")}</Button>
            <Button variant="secondary">{t("buttons.secondary")}</Button>
            <Button variant="ghost">{t("buttons.ghost")}</Button>
            <Button variant="destructive">{t("buttons.destructive")}</Button>
            <Button variant="primary" loading>
              {t("buttons.loading")}
            </Button>
            <Button variant="primary" disabled>
              {t("buttons.primary")}
            </Button>
          </div>
        </Section>

        <Divider />

        {/* Forms */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.forms")}
          </Heading>
          <InteractiveFormDemo />
        </Section>

        <Divider />

        {/* Badges */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.badges")}
          </Heading>
          <div className="flex flex-wrap gap-3">
            <Badge variant="neutral">{t("badges.new")}</Badge>
            <Badge variant="neutral">-20%</Badge>
            <Badge variant="success">{t("badges.inStock")}</Badge>
            <Badge variant="warning">{t("badges.lowStock")}</Badge>
            <Badge variant="error">{t("badges.outOfStock")}</Badge>
          </div>
        </Section>

        <Divider />

        {/* Prices */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.prices")}
          </Heading>
          <div className="flex flex-wrap items-center gap-8">
            <Price amount={1249} />
            <Price amount={899} originalAmount={1249} />
            <Price amount={2490} size="large" />
            <Price amount={499} from />
            <Price amount={null} />
          </div>
        </Section>

        <Divider />

        {/* Cards */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.cards")}
          </Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-body-s text-text-secondary">{t("cardsDemo.default")}</p>
            </Card>
            <Card elevated>
              <p className="text-body-s text-text-secondary">{t("cardsDemo.elevated")}</p>
            </Card>
          </div>
        </Section>

        <Divider />

        {/* Product cards */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.productCards")}
          </Heading>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <ProductCard
              imageAlt="De'Longhi Magnifica S"
              brand="De'Longhi"
              name="Magnifica S"
              condition="new"
              price={4990}
            />
            <ProductCard
              imageAlt="Nespresso Vertuo Next"
              brand="Nespresso"
              name="Vertuo Next"
              condition="excellent"
              price={899}
              originalPrice={1249}
              badgeLabel={t("productBadges.used")}
              warranty
            />
            <ProductCard
              imageAlt="Krups Evidence"
              brand="Krups"
              name="Evidence"
              condition="very-good"
              price={null}
              available={false}
            />
            <ProductCard
              imageAlt="Jura ENA 8"
              brand="Jura"
              name="ENA 8"
              condition="good"
              price={2490}
              badgeLabel={t("productBadges.refurbished")}
              warranty
            />
          </div>
        </Section>

        <Divider />

        {/* States */}
        <Section>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.states")}
          </Heading>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <EmptyState
              title={t("states.emptyTitle")}
              description={t("states.emptyDescription")}
            />
            <ErrorState
              title={t("states.errorTitle")}
              description={t("states.errorDescription")}
            />
          </div>
        </Section>

        <Divider />

        {/* Overlays */}
        <Section spacing="lg">
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {t("sections.overlays")}
          </Heading>
          <InteractiveOverlaysDemo />
        </Section>
      </Container>
    </main>
  );
}
