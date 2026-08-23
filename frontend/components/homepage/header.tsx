import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { LanguageSwitcherCircle } from "@/components/homepage/language-switcher-circle";
import { MobileNav } from "@/components/homepage/mobile-nav";
import { PrimaryNav } from "@/components/homepage/primary-nav";
import { CartWidget } from "@/components/cart/cart-widget";
import { HeaderThemeShell, HeaderLogo } from "@/components/homepage/header-theme";

/**
 * No Search icon — it has no real functionality yet, and shipping a
 * decorative icon that does nothing is exactly the non-functional-
 * looking-production-UI the Phase 3 sign-off ruled out. Cart (Phase 6)
 * is real — see CartWidget, which fetches its own state client-side
 * rather than through this Server Component (see its own comment for
 * why: keeping cookies()/Store API reads out of the root layout keeps
 * Homepage/design-system statically prerendered).
 *
 * "Café & Accessoires" (Nav.coffeeAccessories, still in messages/*.json)
 * is deliberately omitted here too, for the same reason: it had no
 * dedicated destination and was pointing at the same anchor as
 * "Machines", which reads as a real category but goes nowhere specific.
 * Reinstate it once Coffee & Accessories has its own content section
 * or route (see docs/development-environment.md closure notes).
 *
 * VISUAL REDESIGN (dark glassmorphism pill, COFEO wordmark, compact
 * "Machines" dropdown — see components/homepage/primary-nav.tsx): the
 * reference this was designed against used a 5-item order (Accueil /
 * Boutique / À propos / Nos Machines+dropdown / Contact) and dropdown
 * sub-items named after specific coffee-system sub-brands (Nespresso,
 * Dolce Gusto, Accessories). Adopted as closely as this app's real
 * content allows, confirmed with the user rather than guessed:
 * - Accueil ("Home", → "/") — added, since it's a real, existing route
 *   that simply had no explicit nav link before (only the logo linked
 *   home).
 * - Boutique and À propos — NOT added: this app has no shop landing
 *   distinct from the /machines catalogue, and no about page. Adding
 *   either would mean either a duplicate link to the same destination
 *   as "Nos Machines", or a dead link to a page that doesn't exist.
 * - Nos Machines (dropdown) — kept, relabeled from "Machines" to match
 *   the reference's wording (Nav.machinesMenu, header-only — the
 *   original Nav.machines string is untouched since the Footer also
 *   reads it and is out of scope here). Sub-items are COFEO's actual
 *   three product categories (see machineCategories below — the same
 *   ones the Homepage's "Find your machine" tiles already use), not
 *   the reference's sub-brand names, which aren't part of this app's
 *   real category data.
 * - Contact — NOT added: no contact page/route exists.
 * - Occasion / Services — kept as-is (existing homepage anchors,
 *   unaffected by any of the above).
 *
 * There is currently no hero photo anywhere in this app (see the
 * Homepage's own placeholder comment), so the header's glass effect
 * reads against the plain page background rather than hero photography.
 *
 * STICKY: `sticky top-0` on the <header> itself (not `fixed`) — sticky
 * keeps the element in normal flow, so it never removes its own height
 * from the page and can't cause layout shift or reflow the content
 * below it, unlike `fixed`. The <header> has no background of its own
 * (previously `bg-bg`, removed): only the pill inside is opaque/glass,
 * so scrolled content is visible through the gutter around the pill,
 * keeping it a floating pill rather than a full-width bar. z-40 keeps
 * it above page content but below the mobile/cart Drawer's z-50 (see
 * ui/drawer.tsx) so an open drawer still layers over the sticky header.
 *
 * PILL THEME: route-driven, not page-driven — see header-theme.tsx.
 * On Home ("/") the pill is dark "inflated glass" (a faint white haze,
 * thin white-hairline border, soft inner highlight) floating over that
 * page's own dark hero; everywhere else it's a light glass matching
 * that route's own (warm-neutral) tokens, since only Home carries the
 * dark visual identity — Catalogue/Product/Cart/Checkout stay light.
 * `HeaderThemeShell` sets `data-theme="dark"` on the pill only for Home,
 * which is what makes every semantic-token class below (PrimaryNav's
 * text, CartWidget's icon, ...) repaint correctly without per-component
 * theme logic.
 *
 * WIDTH: capped at 1050px and centered, independent of the page
 * Container's own (much wider) max-width — this is meant to read as one
 * compact floating object, not a bar spanning the content column.
 *
 * LANGUAGE SWITCHER: circular flag control (see
 * language-switcher-circle.tsx), replacing the old inline "FR / AR / EN"
 * text switcher here — that component (`LanguageSwitcher`) is untouched
 * and still used as-is by the Footer. Both read/write the same next-intl
 * routing (`routing.locales`, `router.replace(pathname, { locale })`);
 * only the presentation differs.
 */
export async function Header() {
  const t = await getTranslations("Nav");
  const findYourMachine = await getTranslations("FindYourMachine");

  const machinesHref = "/machines";
  const machineCategories = [
    { href: "/machines?category=capsules", label: findYourMachine("capsules") },
    { href: "/machines?category=cafe-moulu", label: findYourMachine("ground") },
    { href: "/machines?category=cafe-en-grains", label: findYourMachine("beans") },
  ];
  const leadingNavItems = [{ href: "/", label: t("home") }];
  const otherNavItems = [
    // Root-relative anchors, not bare "#…" — bare fragments only scroll
    // within whatever page you're already on, which silently breaks
    // once /machines exists as a second real route.
    { href: "/#used-refurbished", label: t("used") },
    { href: "/#services", label: t("services") },
  ];
  // Flat list kept for MobileNav, which renders these in one pass and
  // special-cases whichever entry matches machinesHref to insert the
  // category sub-links right after it.
  const mobileNavItems = [
    ...leadingNavItems,
    { href: machinesHref, label: t("machinesMenu") },
    ...otherNavItems,
  ];

  return (
    <header className="sticky top-0 z-40">
      <Container className="py-4 sm:py-6">
        <div className="mx-auto max-w-[1050px]">
          <HeaderThemeShell>
            <HeaderLogo />

            <PrimaryNav
              ariaLabel={t("primaryNavigation")}
              leadingItems={leadingNavItems}
              machinesHref={machinesHref}
              machinesLabel={t("machinesMenu")}
              machineCategories={machineCategories}
              otherItems={otherNavItems}
            />

            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSwitcherCircle className="hidden md:block" />
              <CartWidget />
              <MobileNav
                navItems={mobileNavItems}
                machinesHref={machinesHref}
                machineCategories={machineCategories}
              />
            </div>
          </HeaderThemeShell>
        </div>
      </Container>
    </header>
  );
}
