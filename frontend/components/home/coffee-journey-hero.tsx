import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { CoffeeJourneyStage } from "@/components/home/coffee-journey-stage";

/**
 * "THE COFEO COFFEE JOURNEY" — replaces the old promo-banner hero
 * (headline + discount callout + a decorative particle canvas sitting
 * beside it) with one continuous scroll-scrubbed sequence: a small
 * field of beans drifts, converges, "grinds" into fine particles, funnels
 * through an abstract extraction, blooms into aroma-like waves, and
 * finally assembles into the COFEO mark — see coffee-journey-stage.tsx
 * for the particle engine driving all of that off a single scroll
 * progress float.
 *
 * Every piece of real content the old hero carried (the exclusive-offer
 * copy, the CTA, the three stat metrics, the "discover our universe"
 * row) is still here — just relocated to the "arrival" panel below the
 * sticky stage, the natural place to land once the mark has formed and
 * the scroll hands off into the rest of the page, rather than crammed
 * onto the same screen as the animation.
 *
 * Local CSS vars (`--espresso-deep`/`--cream`/`--copper`), not tokens.css:
 * this stage is a deliberate one-off dark "atelier" moment bridging into
 * the site's warm-ivory system below it — same reasoning the previous
 * hero used for its own `--gold` var, just re-hued away from black+gold
 * toward roasted-espresso + cream + a restrained copper accent.
 */
const heroVars = {
  "--espresso-deep": "#1c130d",
  "--cream": "#f3ead9",
  "--copper": "#b5714a",
} as CSSProperties;

export async function CoffeeJourneyHero() {
  const t = await getTranslations("Hero");

  const metrics = [
    { value: t("metrics.experience.value"), label: t("metrics.experience.label"), icon: <GlobeIcon /> },
    { value: t("metrics.clients.value"), label: t("metrics.clients.label"), icon: <PeopleIcon /> },
    { value: t("metrics.passion.value"), label: t("metrics.passion.label"), icon: <CupIcon /> },
  ];

  return (
    <>
      {/* No `overflow-hidden` here: an ancestor with overflow != visible
          breaks `position: sticky` on any descendant (a well-known CSS
          gotcha) — the sticky stage inside CoffeeJourneyStage needs this
          section to stay a plain block. The radial-gradient decoration
          below is `inset-0` on a `relative` parent, so there's nothing
          of it to clip in the first place. */}
      <section style={heroVars} className="relative isolate -mt-24 bg-(--espresso-deep) sm:-mt-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_65%_50%_at_50%_38%,rgba(181,113,74,0.14),transparent_62%)]"
        />
        <CoffeeJourneyStage
          eyebrow={t("eyebrow")}
          headlineLine1={t("headlineLine1")}
          headlineLine2={t("headlineLine2")}
          scrollLabel={t("scrollLabel")}
          captions={{
            bean: t("journey.bean"),
            grind: t("process.grinding"),
            extract: t("process.extraction"),
            aroma: t("journey.aroma"),
            universe: t("discoverLabel"),
          }}
        />
      </section>

      {/* Arrival — the scroll hands off here once the mark has formed.
          A short gradient at the top bridges the dark atelier above
          into the site's ivory palette rather than cutting hard. */}
      <section className="relative bg-bg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#1c130d] to-transparent"
        />
        <Container className="relative py-[clamp(3.5rem,9vw,7rem)]">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-6 lg:col-span-7">
              <span className="text-[11px] font-medium tracking-[0.3em] text-bronze uppercase">{t("eyebrow")}</span>
              <div className="flex items-stretch gap-6 border-s-2 border-bronze/40 ps-6">
                <div>
                  <div className="text-xs font-semibold tracking-[0.25em] text-bronze uppercase">{t("promoLabel")}</div>
                  <div className="text-7xl leading-none font-medium text-text-primary sm:text-8xl">{t("promoPercent")}</div>
                </div>
                <div className="flex max-w-[10rem] items-end pb-1 text-xs leading-relaxed font-medium tracking-[0.14em] text-text-secondary uppercase sm:text-sm">
                  {t("promoDescription")}
                </div>
              </div>
              <Link
                href="/machines"
                className="group mt-2 inline-flex w-fit items-center gap-3 rounded-full bg-text-primary px-7 py-3.5 text-xs font-medium tracking-[0.2em] text-text-inverse uppercase transition-colors duration-200 hover:bg-espresso"
              >
                {t("cta")}
                <ArrowRightIcon className="size-3.5 transition-transform duration-300 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
            </div>

            <div className="flex flex-col gap-8 lg:col-span-5 lg:mt-10 lg:border-s lg:border-border lg:ps-8">
              <div className="flex items-center gap-4">
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-border-strong">
                  <PlayIcon className="size-4 text-bronze rtl:-scale-x-100" />
                </span>
                <div className="text-xs leading-relaxed font-medium tracking-[0.15em] uppercase">
                  <div className="text-text-muted">{t("discoverEyebrow")}</div>
                  <div className="text-text-primary">{t("discoverLabel")}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-4">
                {metrics.map((m) => (
                  <div key={m.label} className="flex items-center gap-2.5 sm:gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-bronze sm:size-10">
                      {m.icon}
                    </span>
                    <div>
                      <div className="text-base font-semibold text-text-primary sm:text-xl">{m.value}</div>
                      <div className="text-[9px] leading-tight tracking-[0.1em] text-text-muted uppercase sm:text-[11px] sm:tracking-[0.12em]">
                        {m.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-6-6m6 6-6 6" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5Z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" />
      <path strokeLinecap="round" d="M3.5 19c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <circle cx="16.5" cy="9" r="2.3" />
      <path strokeLinecap="round" d="M15 14.7c2.2.2 3.6 1.6 4.2 3.8" />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4" aria-hidden="true">
      <path strokeLinecap="round" d="M5 9h11v5.5A4.5 4.5 0 0 1 11.5 19h-2A4.5 4.5 0 0 1 5 14.5V9Z" />
      <path strokeLinecap="round" d="M16 10.5h1.2a2.3 2.3 0 0 1 0 4.6H16" />
      <path strokeLinecap="round" d="M8.5 4.8c-.6.6-.6 1.2 0 1.8s.6 1.2 0 1.8" />
      <path strokeLinecap="round" d="M12 4.8c-.6.6-.6 1.2 0 1.8s.6 1.2 0 1.8" />
    </svg>
  );
}
