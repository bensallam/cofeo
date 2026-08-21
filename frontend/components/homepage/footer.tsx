import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LanguageSwitcher } from "@/components/homepage/language-switcher";

export async function Footer() {
  const t = await getTranslations("Nav");
  const rights = await getTranslations("Footer");

  // "Café & Accessoires" omitted — see the note in components/homepage/header.tsx.
  // Root-relative anchors for the same reason as Header.
  const navItems = [
    { href: "/machines", label: t("machines") },
    { href: "/#used-refurbished", label: t("used") },
    { href: "/#services", label: t("services") },
  ];

  return (
    <footer className="border-t border-border">
      <Container>
        <Section spacing="sm" className="flex flex-col gap-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <span className="text-body-l font-semibold tracking-tight text-text-primary">
              COFEO
            </span>
            <nav
              className="flex flex-wrap items-center gap-6"
              aria-label={t("primaryNavigation")}
            >
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-body-s text-text-secondary transition-colors duration-200 hover:text-text-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <LanguageSwitcher />
          </div>
          <p className="text-caption text-text-muted">
            © {new Date().getFullYear()} COFEO — {rights("rights")}
          </p>
        </Section>
      </Container>
    </footer>
  );
}
