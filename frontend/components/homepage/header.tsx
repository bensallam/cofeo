import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { LanguageSwitcher } from "@/components/homepage/language-switcher";
import { MobileNav } from "@/components/homepage/mobile-nav";
import { CartWidget } from "@/components/cart/cart-widget";

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
 */
export async function Header() {
  const t = await getTranslations("Nav");

  const navItems = [
    { href: "/machines", label: t("machines") },
    // Root-relative anchors, not bare "#…" — bare fragments only scroll
    // within whatever page you're already on, which silently breaks
    // once /machines exists as a second real route.
    { href: "/#used-refurbished", label: t("used") },
    { href: "/#services", label: t("services") },
  ];

  return (
    <header className="border-b border-border bg-bg">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-body-l font-semibold tracking-tight text-text-primary">
            COFEO
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label={t("primaryNavigation")}>
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-body-s text-text-primary transition-colors duration-200 hover:text-text-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <LanguageSwitcher className="hidden md:flex" />
            <CartWidget />
            <MobileNav navItems={navItems} />
          </div>
        </div>
      </Container>
    </header>
  );
}
