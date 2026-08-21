"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconButton } from "@/components/ui/icon-button";
import { Drawer } from "@/components/ui/drawer";
import { LanguageSwitcher } from "@/components/homepage/language-switcher";

type NavItem = { href: string; label: string };

type MobileNavProps = {
  navItems: NavItem[];
};

export function MobileNav({ navItems }: MobileNavProps) {
  const t = useTranslations("Nav");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <IconButton
        aria-label={t("openMenu")}
        onClick={() => setIsOpen(true)}
        className="md:hidden"
      >
        <MenuIcon />
      </IconButton>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("menuTitle")}>
        <nav className="flex flex-col gap-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="text-body-l text-text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <LanguageSwitcher />
        </div>
      </Drawer>
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
