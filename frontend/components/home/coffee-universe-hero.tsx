import type { CSSProperties } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { CoffeeParticleCanvas } from "@/components/home/coffee-particle-canvas";
import { cn } from "@/lib/design/cn";

/**
 * Cinematic dark hero — a deliberate one-off, not built from the shared
 * light/monochrome primitives (Heading, Button, --color-* tokens): the
 * brief is a specific approved visual reference (near-black + warm gold,
 * full-bleed, editorial), incompatible with the site's restrained
 * light-surface system by design, same reasoning as the header pill's
 * `rounded-full` override. `--gold` is a hero-local CSS custom property
 * (set via inline style below), not added to tokens.css — nothing else
 * on the site uses it, and tokens.css stays monochrome-by-design.
 *
 * `-mt-24 sm:-mt-28` pulls the section up by exactly the sticky
 * Header's own rendered height (`py-4 sm:py-6` + `h-16` pill = 6rem /
 * 7rem, see header.tsx) so the header's glass pill floats directly over
 * this hero's dark background with no gap, matching the reference.
 * Every other page keeps the header's normal in-flow spacing untouched.
 *
 * The particle/bean simulation itself is isolated in
 * coffee-particle-canvas.tsx (a client component) so this component
 * stays a server-rendered async function — only that one small canvas
 * subtree hydrates on the client.
 */
const heroVars = { "--gold": "#c9a35e" } as CSSProperties;

export async function CoffeeUniverseHero() {
  const locale = await getLocale();
  const rtl = locale === "ar";
  const t = await getTranslations("Hero");

  const processSteps = [
    { n: "01", label: t("process.origin") },
    { n: "02", label: t("process.roasting") },
    { n: "03", label: t("process.grinding") },
    { n: "04", label: t("process.extraction") },
  ];

  const metrics = [
    { value: t("metrics.experience.value"), label: t("metrics.experience.label"), icon: <GlobeIcon /> },
    { value: t("metrics.clients.value"), label: t("metrics.clients.label"), icon: <PeopleIcon /> },
    { value: t("metrics.passion.value"), label: t("metrics.passion.label"), icon: <CupIcon /> },
  ];

  return (
    <section
      style={heroVars}
      className="relative isolate -mt-24 flex min-h-[100svh] flex-col overflow-hidden bg-[#070503] text-white sm:-mt-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_70%_55%_at_82%_15%,rgba(150,92,32,0.16),transparent_60%),radial-gradient(ellipse_60%_50%_at_8%_88%,rgba(90,54,20,0.14),transparent_60%)]"
      />

      {/* Left-margin pagination decor — secondary, desktop only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute start-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
      >
        <span className="h-8 w-px bg-white/15" />
        <span className="flex size-2.5 items-center justify-center rounded-full ring-1 ring-(--gold)">
          <span className="size-1.5 rounded-full bg-(--gold)" />
        </span>
        <span className="size-1.5 rounded-full bg-white/25" />
        <span className="size-1.5 rounded-full bg-white/25" />
      </div>

      {/* Right-edge tick scale — secondary, desktop only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute end-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-end gap-2.5 lg:flex"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className={cn("h-px rounded-full", i === 4 ? "w-6 bg-(--gold)" : "w-3 bg-white/20")}
          />
        ))}
      </div>

      <Container className="relative flex flex-1 flex-col pt-32 sm:pt-36">
        <div className="grid flex-1 items-center gap-10 md:grid-cols-2 md:gap-8">
          <div className="relative z-10 flex max-w-xl flex-col gap-6 py-8 md:py-16">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-(--gold)">
              <ArrowIcon className="size-3.5 rtl:rotate-180" />
              {t("eyebrow")}
            </div>

            <h1 className="text-5xl font-medium uppercase leading-[0.95] tracking-wide sm:text-6xl lg:text-7xl">
              <span className="block text-white">{t("headlineLine1")}</span>
              <span className="block text-(--gold)">{t("headlineLine2")}</span>
            </h1>

            <p className="max-w-sm text-sm text-white/65 sm:text-base">{t("supporting")}</p>

            <div className="mt-1 flex items-stretch gap-5 border-s-2 border-(--gold)/40 ps-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-(--gold)">
                  {t("promoLabel")}
                </div>
                <div className="text-6xl leading-none font-bold text-(--gold) sm:text-7xl">
                  {t("promoPercent")}
                </div>
              </div>
              <div className="flex max-w-[9rem] items-end pb-1 text-xs font-medium uppercase leading-relaxed tracking-[0.14em] text-white/70 sm:text-sm">
                {t("promoDescription")}
              </div>
            </div>

            <Link
              href="/machines"
              className="group mt-2 inline-flex w-fit items-center gap-3 rounded-full border border-(--gold)/50 px-6 py-3 text-xs font-medium uppercase tracking-[0.2em] text-(--gold) transition-colors duration-300 hover:bg-(--gold)/10"
            >
              {t("cta")}
              <ArrowRightIcon className="size-3.5 transition-transform duration-300 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
          </div>

          <div className="relative min-h-[320px] w-full sm:min-h-[400px] md:min-h-[560px]">
            <CoffeeParticleCanvas rtl={rtl} className="absolute inset-0 overflow-hidden" />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 hidden size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 md:block lg:size-[520px]"
            />

            <div className="pointer-events-none absolute start-2 top-0 hidden text-start md:block">
              <div className="text-sm font-semibold text-(--gold)">01</div>
              <div className="text-[11px] tracking-[0.2em] text-white/50 uppercase">
                {t("process.origin")}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-y-6 end-0 hidden flex-col justify-between text-end md:flex">
              {processSteps.map((step) => (
                <div key={step.n}>
                  <div className="text-sm font-semibold text-(--gold)">{step.n}</div>
                  <div className="text-[11px] tracking-[0.2em] text-white/50 uppercase">{step.label}</div>
                </div>
              ))}
            </div>

            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden size-full opacity-40 md:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d={rtl ? "M 30 46 Q 55 40 78 55" : "M 70 46 Q 45 40 22 55"}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="0.12"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={rtl ? "M 34 62 Q 55 58 72 68" : "M 66 62 Q 45 58 28 68"}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="0.12"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>
      </Container>

      <Container className="relative border-t border-white/10 py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
          <div className="flex items-center gap-4">
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-(--gold)/40">
              <PlayIcon className="size-4 text-(--gold) rtl:-scale-x-100" />
            </span>
            <div className="text-xs leading-relaxed font-medium tracking-[0.15em] uppercase">
              <div className="text-white/50">{t("discoverEyebrow")}</div>
              <div className="text-white">{t("discoverLabel")}</div>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-white/10 sm:block" />

          <div className="grid grow grid-cols-3 gap-4 sm:flex sm:w-auto sm:grow-0 sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-4">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-2.5 sm:gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-(--gold) sm:size-10">
                  {m.icon}
                </span>
                <div>
                  <div className="text-base font-semibold text-white sm:text-xl">{m.value}</div>
                  <div className="text-[9px] leading-tight tracking-[0.1em] text-white/50 uppercase sm:text-[11px] sm:tracking-[0.12em]">
                    {m.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden h-10 w-px bg-white/10 lg:block" />

          <div className="hidden items-center gap-3 lg:flex">
            <span className="flex size-10 items-center justify-center rounded-full border border-white/15 text-sm text-white/70">
              !
            </span>
            <span className="text-[11px] font-medium tracking-[0.2em] text-white/50 uppercase">
              {t("scrollLabel")}
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5-5m5 5-5 5" />
    </svg>
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
