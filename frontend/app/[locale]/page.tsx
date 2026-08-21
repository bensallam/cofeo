import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { ProductCard } from "@/components/ui/product-card";
import { DiscoveryTile } from "@/components/homepage/discovery-tile";
import { ProcessStep } from "@/components/homepage/process-step";
import { CoffeeUniverseHero } from "@/components/home/coffee-universe-hero";
import { DEMO_FEATURED_PRODUCTS, DEMO_BRANDS } from "@/lib/demo-data/products";
import { publicEnv } from "@/config/env";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Hero" });

  return {
    title: `COFEO — ${t("headline")}`,
    description: t("supporting"),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      title: `COFEO — ${t("headline")}`,
      description: t("supporting"),
      // No production Open Graph image yet — [CONTENT REQUIRED].
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const findYourMachine = await getTranslations("FindYourMachine");
  const featuredMachines = await getTranslations("FeaturedMachines");
  const whyCofeo = await getTranslations("WhyCofeo");
  const brands = await getTranslations("Brands");
  const usedRefurbished = await getTranslations("UsedRefurbished");
  const services = await getTranslations("Services");
  const finalCta = await getTranslations("FinalCta");
  const product = await getTranslations("Product");

  // Now that the real Catalogue exists (/machines), these route into it
  // pre-filtered rather than scrolling to the Homepage's own demo section.
  const discoveryTiles = [
    { href: "/machines?category=capsules", label: findYourMachine("capsules") },
    { href: "/machines?category=cafe-moulu", label: findYourMachine("ground") },
    { href: "/machines?category=cafe-en-grains", label: findYourMachine("beans") },
  ];

  const processSteps = [
    usedRefurbished("steps.selection"),
    usedRefurbished("steps.inspection"),
    usedRefurbished("steps.testing"),
    usedRefurbished("steps.cleaning"),
    usedRefurbished("steps.preparation"),
    usedRefurbished("steps.warranty"),
  ];

  // Organization schema — confirmed facts only (brand name + approved
  // positioning line from the master brief). No logo/social/address:
  // none of those are confirmed, so none are included.
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "COFEO",
    description: "Selected. Tested. Transparent. Professional.",
    url: publicEnv.NEXT_PUBLIC_SITE_URL,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* Hero — cinematic dark "coffee universe" concept, approved
       * reference. See coffee-universe-hero.tsx for the full rationale;
       * it renders its own <h1> so this page no longer needs the
       * Heading/Button-based markup that used to live here. */}
      <CoffeeUniverseHero />

      <Divider />

      {/* Find Your Machine */}
      <Section id="find-your-machine">
        <Container>
          <Heading level={2} size="l" className="mb-8 max-w-xl">
            {findYourMachine("heading")}
          </Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {discoveryTiles.map((tile) => (
              <DiscoveryTile key={tile.label} href={tile.href} label={tile.label} />
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* Featured Machines — demo data only, see lib/demo-data/products.ts */}
      <Section id="featured-machines">
        <Container>
          <Heading level={2} size="l" className="mb-8">
            {featuredMachines("heading")}
          </Heading>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {DEMO_FEATURED_PRODUCTS.map((item) => (
              <ProductCard
                key={item.id}
                imageAlt={`${item.brand} ${item.name}`}
                brand={item.brand}
                name={item.name}
                condition={item.condition}
                price={item.price}
                originalPrice={item.originalPrice}
                available={item.available}
                warranty={item.warranty}
                badgeLabel={item.badgeKey ? product(`badges.${item.badgeKey}`) : undefined}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* Why COFEO */}
      <Section>
        <Container>
          <Heading level={2} size="l" className="mb-8">
            {whyCofeo("heading")}
          </Heading>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {(["selection", "transparency", "preparation"] as const).map((pillar) => (
              <div key={pillar} className="flex flex-col gap-2">
                <Heading level={3} size="s">
                  {whyCofeo(`pillars.${pillar}.title`)}
                </Heading>
                <p className="text-body-s text-text-secondary">
                  {whyCofeo(`pillars.${pillar}.description`)}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* Explore by Brand — inline composition, text-only (no logos: licensing unconfirmed) */}
      <Section spacing="sm">
        <Container>
          <Heading level={2} size="s" className="mb-6 text-text-muted">
            {brands("heading")}
          </Heading>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {DEMO_BRANDS.map((brand) => (
              <span key={brand} className="text-body-l text-text-primary">
                {brand}
              </span>
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* Used / Refurbished — direction A approved */}
      <Section id="used-refurbished">
        <Container>
          <div className="max-w-2xl">
            <Heading level={2} size="l">
              {usedRefurbished("heading")}
            </Heading>
            <p className="mt-4 text-body-l text-text-secondary">
              {usedRefurbished("supporting")}
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {processSteps.map((label, index) => (
              <ProcessStep key={label} step={index + 1} label={label} />
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* Services teaser — informational only, Services page doesn't exist yet (no dead link) */}
      <Section spacing="sm" id="services">
        <Container>
          <Heading level={2} size="s" className="mb-2 text-text-muted">
            {services("heading")}
          </Heading>
          <p className="text-body-l text-text-primary">{services("description")}</p>
        </Container>
      </Section>

      <Divider />

      {/* Final CTA */}
      <Section spacing="lg">
        <Container>
          <div className="flex flex-col items-start gap-6">
            <Heading level={2} size="xl">
              {finalCta("heading")}
            </Heading>
            <Button variant="primary" href="/machines">
              {finalCta("cta")}
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
