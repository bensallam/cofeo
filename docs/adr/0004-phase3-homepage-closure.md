# 4. Phase 3 Homepage closure decisions

## Status

Accepted

## Context

Phase 3 Homepage implementation and its visual QA pass were complete, but
three items were flagged for explicit closure before Phase 4: real
photography, the "Café & Accessoires" nav item's missing destination,
and a performance sanity check.

## Decisions

**1. Photography stays placeholder.** No production-looking imagery was
generated, downloaded, or faked for Hero or Discovery tiles. Both
render clearly-marked placeholder boxes (`bg-bg` fills, `aria-hidden`).
Tracked as **CONTENT/ASSET REQUIRED**: real photography for the Hero
(single hero-quality machine shot) and the three Discovery tiles
(Capsules / Ground Coffee / Coffee Beans) must come from the business
before these sections can be considered visually final.

**2. "Café & Accessoires" removed from primary navigation (Option B).**
It previously pointed at the same anchor as "Machines" — a real-looking
nav item with no real destination. Removed from both `Header` and
`Footer`'s `navItems` arrays rather than left in a disabled/placeholder
state, because there's no content architecture for Coffee & Accessories
yet to even gesture at (Option A — a visibly-disabled item — would
still be promising a category that doesn't exist in any form on the
site today). The translation key (`Nav.coffeeAccessories`) is left in
`messages/*.json` — not deleted — so reinstating the nav item is a
one-line change once Coffee & Accessories gets a real section or route.
Primary nav is now three items: Machines, Occasion, Services — all
three point at real content that exists on this page today.

**3. Performance: lightweight local check only, Lighthouse NOT RUN.**
No Lighthouse or external monitoring tool is available in this
environment, and none was installed (no new dependency, per the
governance rule). What was actually measured, against the production
build (`next build` + `next start`), not dev mode:

- Local TTFB: ~9–46ms (`/ar`, `/fr` — expected for a statically
  prerendered route served locally; not representative of real-world
  network latency).
- Zero console messages of any kind (not just zero errors — zero
  output at all) on a fresh production-build load of `/fr`, checked
  via a real browser, not just curl.
- Network panel: 18 requests total on first load — 5 font files, one
  CSS bundle, ~9 JS chunks, and 3 `?_rsc=` requests that are Next.js's
  own same-page Link prefetching (standard framework behavior, not a
  bug). **Zero image requests** — confirms the Hero/Discovery
  placeholders genuinely don't fetch anything.
- Client-side JS surface: `grep`-verified 7 files carry `"use client"`
  (one of those matches is a comment in `tokens.css`, not a real
  directive — 6 real client files). Of those, only `mobile-nav.tsx`,
  `language-switcher.tsx`, `drawer.tsx` (nested inside MobileNav), and
  the layout-wide `motion-provider.tsx` actually load on the Homepage
  route — `modal.tsx`, `toast.tsx`, and `interactive-demo.tsx` are
  `/design-system`-only and don't ship to Homepage visitors (Next.js
  route-level code splitting). Every content section (Hero, Find Your
  Machine, Featured Machines, Why COFEO, Explore by Brand,
  Used/Refurbished, Services, Final CTA) and both Header/Footer shells
  are Server Components.
- Hero loading behavior: confirmed CSS-only (`animate-fade-in-up` in
  `tokens.css`), no client JS involved in the entrance animation.

This is a real, if narrow, verification — not a substitute for an
actual Lighthouse/Core Web Vitals audit, which should happen once real
photography is in place (placeholder boxes are lighter than real
images, so current numbers are optimistic for LCP specifically).

## Consequences

- Coffee & Accessories needs a decision in a future phase: does it get
  its own Homepage section, or does it only live in the eventual
  Catalogue (Phase 5)? Not decided here — deliberately left open rather
  than guessed.
- A real Lighthouse pass (or equivalent) should happen once real
  photography replaces the placeholders, since image weight is the
  most likely thing to change the LCP picture materially.
