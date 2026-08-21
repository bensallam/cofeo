# 3. Design system: zero-dependency components, native `<dialog>`, IBM Plex pairing

## Status

Accepted

## Context

Phase 2 needed a visual foundation (~20 components) matching a
"Scandinavian Minimal × Swiss Modern" direction, monochrome-first, fully
RTL-correct for Arabic, WCAG 2.2 AA, with an explicit constraint against
installing a UI component library.

## Decisions

**1. Hand-written variant system, no `cva`/`clsx`/`tailwind-merge`.**
At ~20 components with typed-prop variants (not freeform className
overrides everywhere), a variant library isn't earning its weight yet.
Revisit if/when component consumers need to override classes in ways
plain TS unions can't express cleanly.

**2. Native `<dialog>` for Modal, not a portal + focus-trap dependency.**
`.showModal()`/`.close()` via ref+effect gives correct focus trapping,
Esc-to-close, and top-layer stacking for free, with better default
accessibility than most hand-rolled implementations. Confirmed in the
compiled build that the `::backdrop` pseudo-element and Tailwind's
`backdrop:` variant work as expected.

**3. Typeface: IBM Plex Sans (Latin) + IBM Plex Sans Arabic, via
`next/font/google`.** One family designed across both scripts (matching
weight/x-height) rather than pairing two unrelated fonts. Zero npm
dependency — `next/font` is bundled with Next.js. Approved by the user
after being flagged as an open decision in the pre-implementation
checkpoint (the brief specified the direction but not a specific
typeface).

**4. Runtime script-switching via CSS custom properties, not
per-component logic.** `app/styles/tokens.css` redeclares `--font-sans`,
every `--tracking-*`, and body-scale `--text-*--line-height` values
under `[dir="rtl"]`. Because Tailwind v4 utilities compile to
`var(--token)` rather than inlining values, this one block correctly
flips font family, neutralizes letter-spacing (which breaks Arabic's
cursive joining if left applied), and loosens body line-height for every
component built on these utilities — no component needs to know its
own render direction.

**5. `border` vs `border-strong` as two separate tokens.** WCAG 2.2's
3:1 non-text contrast requirement applies to boundaries conveying
required information (input/button edges), not decorative dividers.
Splitting the token lets hairline dividers stay subtle (`border`,
1.4:1) while interactive element edges meet the requirement
(`border-strong`, 3.47:1) — computed, not estimated.

**6. Drawer and Toast are visual-foundation-only.** Drawer has
Escape-to-close but not a full focus trap; Toast is a single controlled
component with no global queue/provider. Both require real usage
context (Cart, Nav) to design correctly — building that now would be
speculative. Explicitly logged as scope decisions in the Phase 2
checkpoint, not gaps discovered later.

## Consequences

- Any future variant-heavy component work that finds the hand-written
  approach awkward should come back through the "new dependency" gate
  (`cva`/similar) rather than silently growing ad-hoc solutions.
- Drawer/Toast will need revisiting — not from scratch, but hardening —
  once Cart (Phase 7) or another feature actually wires them up.
- The `[dir="rtl"]` token-override pattern is now the established way to
  handle any future script-dependent styling need; new components
  should reach for this before writing per-component `dir === "rtl"`
  branches.
