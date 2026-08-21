# COFEO Design System

Internal reference for the visual system implemented in Phase 2. Live
showcase: `/fr/design-system`, `/ar/design-system`, `/en/design-system`
(dev-only — `noindex`, never linked from customer-facing pages).

## Visual principles

Scandinavian Minimal × Swiss Modern, read as an editorial coffee-equipment
catalog rather than an e-commerce template. Premium is carried by
typography, whitespace, alignment, and photography — never by gradients,
heavy shadows, saturated color, or rounded-everything cards. The interface
stays predominantly monochrome; the only color in the system is the three
semantic feedback tones (success/warning/error), never decorative.

## Token architecture

Two tiers, both in `app/styles/tokens.css` via Tailwind v4's CSS-native
`@theme`:

- **Primitives** (`--color-gray-*`) — raw values, never referenced
  directly by components.
- **Semantic** (`--color-bg`, `--color-text-primary`, `--color-border-strong`...)
  — named by role, what components actually consume.

Motion durations/easing are mirrored as plain TS constants in
`lib/design/motion.ts` (CSS custom properties aren't readable by the
`motion` library's JS transition config — this is the one deliberate
exception to "everything lives in tokens.css").

## Color

| Token | Value | Use | Contrast |
|---|---|---|---|
| `bg` | `#F5F5F2` | Page background | — |
| `surface` / `surface-elevated` | `#FFFFFF` | Cards, modals | — |
| `surface-hover` | `#F5F5F2` | Hover tint on transparent/outline elements | — |
| `text-primary` | `#111111` | Primary text | 17.3:1 on bg |
| `text-secondary` | `#3F3F3F` | Secondary text | 9.6:1 on bg |
| `text-muted` | `#5C5C5C` | Tertiary/caption text | 6.1:1 on bg |
| `border` | `#D9D9D6` | Decorative dividers/hairlines only | 1.4:1 (not for interactive boundaries) |
| `border-strong` | `#8A8A86` | Input/button boundaries (must convey information) | 3.47:1 — meets WCAG 2.2 non-text 3:1 |
| `focus-ring` | `#000000` | Focus outline (monochrome — no accent color) | 19–21:1 |
| `success` / `warning` / `error` | `#2F6B4F` / `#8A5A00` / `#B42318` | System feedback only | 5.4–6.0:1 on bg |

All ratios above are computed WCAG 2.1 relative-luminance values, not
visual estimates (see the Phase 2 design checkpoint for the calculation
method). `text-muted` was deliberately moved from an earlier `#6B6B6B`
(4.88:1) to `#5C5C5C` (6.12:1) for more safety margin above the 4.5:1 AA
minimum.

`border` vs `border-strong` is a deliberate split: WCAG 2.2's 3:1
non-text contrast rule applies to boundaries that convey required
information (an input's edge, a secondary button's edge) — not to purely
decorative dividers. Using the lighter `border` for hairlines and the
darker `border-strong` for interactive edges satisfies the rule exactly
where it applies, without darkening every hairline in the UI.

## Typography

**Latin (FR/EN): IBM Plex Sans. Arabic: IBM Plex Sans Arabic.** One type
family designed across both scripts (matching weight/x-height), loaded
via `next/font/google` — no npm font dependency. The active family swaps
automatically based on `[dir]` (see `app/styles/tokens.css`'s `--font-sans`
override under `[dir="rtl"]`), not per-component logic.

Two Arabic-specific corrections, both handled systemically rather than
per-component:

- **Letter-spacing is neutralized under RTL.** Tracking breaks Arabic's
  cursive letter-joining, so every `tracking-*` utility resolves to `0em`
  under `[dir="rtl"]` automatically.
- **Body line-height is increased under RTL** (`1.6` → `1.75` for
  `body`/`body-l`, `1.5` → `1.65` for `body-s`) — Arabic's diacritics and
  denser glyph shapes need more vertical room at body text sizes.
  Heading/display sizes keep their tighter leading in both scripts.

### Scale

`display` `heading-xl` `heading-l` `heading-m` `heading-s` `body-l` `body`
`body-s` `caption` `price` `price-lg` — each a paired Tailwind
`--text-*`/`--text-*--line-height` token, so e.g. `text-display` sets
both font-size and line-height in one utility class. Prices use
`tabular-nums` (Tailwind's built-in `font-variant-numeric` utility) so
figures align in grids.

## Layout

- `Container`: max-width `80rem` (1280px), fluid gutter
  (`clamp(1rem, 4vw, 3rem)`) — scales smoothly instead of jumping at
  breakpoints.
- `Section`: vertical rhythm (`sm`/`md`/`lg`), also fluid via `clamp()`.
- Tailwind's default breakpoint scale (`sm` 640px, `md` 768px, `lg`
  1024px, `xl` 1280px, `2xl` 1536px) — no custom breakpoints needed.
- Every component uses CSS logical properties exclusively
  (`ps-*`/`pe-*`/`ms-*`/`me-*`/`text-start`/`text-end`/`inset-inline-*`)
  — no `pl-`/`pr-`/`ml-`/`mr-`/`text-left`/`text-right` anywhere in the
  system. Enforced by review discipline for now, not tooling.

## Components

Visual foundation for: Button, Link, Input, Select, Checkbox, Radio,
Badge, Price, Divider, Card, ProductCard, Container, Section, Heading,
IconButton, Modal, Drawer, Toast, Skeleton, EmptyState, ErrorState — all
in `components/ui/`.

All interactive states are defined where relevant: default, hover,
active, focus (visible, monochrome ring), disabled, loading (Button),
error (Input/Select). No variant library (`cva`, etc.) — variants are
typed TS unions mapped to class strings, hand-written; revisit only if
that genuinely stops scaling.

- **Modal** uses the native `<dialog>` element (`.showModal()`/`.close()`
  via ref+effect) — correct focus trap, Esc-to-close, and top-layer
  stacking for free, no portal/focus-trap dependency.
- **Drawer** is visual-foundation-only: slides in from the *logical* end
  (`inset-inline-end` + an `rtl:`-aware transform, so it's the right side
  in LTR and the left side in RTL with no per-usage direction logic),
  Escape-to-close wired. A full focus trap is deferred to whichever later
  phase wires it into real Cart/Nav usage.
- **Toast** is a single controlled component, no global queue/provider
  yet — that's app-wide state that only makes sense once something real
  needs to notify.

### ProductCard

The image dominates the composition — everything else is compact text
below it. No card border/shadow by default (grid gap + the image itself
separate cards). Supports image (with a placeholder state when none is
provided — a realistic pre-photo-upload case, not just a demo
convenience), brand, name, condition, price (via `Price`), a badge slot,
availability, and a warranty indicator.

### Price

Single reusable formatter (`lib/i18n/price.ts`, `Intl.NumberFormat`,
locale-aware: `fr-MA`/`ar-MA`/`en-MA`) — **no component formats currency
itself**. Supports regular, sale (crossed-out original), "from"-prefixed,
and unavailable states. Prepared for MAD; the currency code is still a
parameter.

## Motion

`motion` package (already installed in Phase 1). Durations 120–320ms,
a single "precise" easing curve (`cubic-bezier(0.22, 1, 0.36, 1)` —
duration-based, not spring physics, which reads as playful/SaaS rather
than editorial). A global `MotionConfig reducedMotion="user"` wrapper in
the root layout makes every Motion-animated component respect
`prefers-reduced-motion` automatically. CSS-only animations
(`animate-pulse`, transitions) are covered by a separate global
`@media (prefers-reduced-motion: reduce)` rule in `tokens.css`.

## Accessibility baseline

- Semantic HTML throughout (real `<button>`, `<label htmlFor>`, native
  `<dialog>`, `role="separator"`/`role="alert"`/`role="status"` where
  appropriate).
- Input/Select own their label/hint/error association via a generated
  id and `aria-describedby` — callers can't forget to wire it.
- Visible, monochrome focus ring (`:focus-visible`, 2px, 2px offset) on
  every interactive element.
- `IconButton` requires an `aria-label` prop at the type level — an
  icon-only button with no accessible name doesn't compile.
- All contrast ratios computed programmatically (see Color table above),
  not eyeballed.

## Verified

Confirmed against the actual compiled output (not just source review):
`/fr`, `/ar`, `/en` design-system routes all return 200; `<html dir="rtl">`
on Arabic; Arabic translations render; compiled CSS contains the
`[dir=rtl]` font/tracking/line-height overrides, the `::backdrop` rule
for Modal, and the `tabular-nums` utility; `:focus-visible` and
`prefers-reduced-motion` rules present in the compiled CSS; typecheck,
lint, tests, and production build all green.
