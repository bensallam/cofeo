import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { DiscoveryTile } from "@/components/homepage/discovery-tile";
import { ProcessStep } from "@/components/homepage/process-step";
import { EditorialProductFeature } from "@/components/homepage/editorial-product-feature";
import { CoffeeJourneyHero } from "@/components/home/coffee-journey-hero";
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

  const discoveryTiles = [
    { href: "/machines?category=capsules", label: findYourMachine("capsules") },
    { href: "/machines?category=cafe-moulu", label: findYourMachine("ground") },
    { href: "/machines?category=cafe-en-grains", label: findYourMachine("beans") },
  ];

  const pillars = ["selection", "transparency", "preparation"] as const;

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

      {/* INTRO + COFFEE JOURNEY — the scroll-scrubbed particle sequence
          plus its real-content "arrival" panel; see coffee-journey-hero.tsx. */}
      <CoffeeJourneyHero />

      {/* THE COFEO UNIVERSE — Find Your Machine + Why COFEO merged into
          one asymmetric spread instead of two separate boxed sections:
          the three real category entry points on the left, the three
          brand pillars as a numbered list on the right, offset down for
          asymmetry rather than aligned in a neat row. */}
      <Section spacing="lg">
        <Container>
          <Heading level={2} size="xl" className="max-w-2xl">
            {findYourMachine("heading")}
          </Heading>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-4 lg:col-span-5">
              {discoveryTiles.map((tile) => (
                <DiscoveryTile key={tile.label} href={tile.href} label={tile.label} />
              ))}
            </div>

            <div className="flex flex-col gap-10 lg:col-span-6 lg:col-start-7 lg:mt-16">
              {pillars.map((pillar, index) => (
                <div key={pillar} className="flex gap-6 border-t border-border pt-6 first:border-t-0 first:pt-0">
                  <span className="text-caption text-text-muted tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <div className="flex flex-col gap-2">
                    <Heading level={3} size="s">
                      {whyCofeo(`pillars.${pillar}.title`)}
                    </Heading>
                    <p className="max-w-md text-body-s text-text-secondary">
                      {whyCofeo(`pillars.${pillar}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Divider />

      {/* MACHINES — demo data only, see lib/demo-data/products.ts. Large
          editorial tiles (see EditorialProductFeature), not a dense
          ecommerce grid — this is four curated pieces, not a catalogue. */}
      <Section spacing="lg" id="featured-machines">
        <Container>
          <Heading level={2} size="xl" className="max-w-xl">
            {featuredMachines("heading")}
          </Heading>
          <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-16 sm:grid-cols-2 [&>*:nth-child(even)]:sm:mt-20">
            {DEMO_FEATURED_PRODUCTS.map((item, index) => (
              <EditorialProductFeature
                key={item.id}
                href="/machines"
                index={index}
                imageAlt={`${item.brand} ${item.name}`}
                brand={item.brand}
                name={item.name}
                condition={item.condition}
                price={item.price}
                originalPrice={item.originalPrice}
                available={item.available}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* ACCESSORIES-position section — real content is the brand list
          (no accessories catalogue exists yet); presented as a large
          typographic wall rather than a small muted caption row. */}
      <Section spacing="sm">
        <Container>
          <Heading level={2} size="s" className="mb-8 text-text-muted">
            {brands("heading")}
          </Heading>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {DEMO_BRANDS.map((brand) => (
              <span key={brand} className="text-heading-m font-medium text-text-primary/80 transition-colors duration-200 hover:text-text-primary">
                {brand}
              </span>
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* DISCOVERY — the used/refurbished trust process, direction A
          approved; large numerals carry more of the composition now. */}
      <Section id="used-refurbished">
        <Container>
          <div className="max-w-2xl">
            <Heading level={2} size="l">
              {usedRefurbished("heading")}
            </Heading>
            <p className="mt-4 text-body-l text-text-secondary">{usedRefurbished("supporting")}</p>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
            {processSteps.map((label, index) => (
              <ProcessStep key={label} step={index + 1} label={label} />
            ))}
          </div>
        </Container>
      </Section>

      <Divider />

      {/* BRAND — Services teaser + Final CTA merged into one closing
          statement instead of two stacked sections. */}
      <Section spacing="lg" id="services">
        <Container>
          <div className="flex flex-col items-start gap-8">
            <div className="flex flex-col gap-2">
              <span className="text-caption font-medium tracking-[0.2em] text-text-muted uppercase">
                {services("heading")}
              </span>
              <p className="max-w-xl text-body-l text-text-secondary">{services("description")}</p>
            </div>
            <Heading level={2} size="xl" className="max-w-3xl">
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
