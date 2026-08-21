"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IconButton } from "@/components/ui/icon-button";
import { Drawer } from "@/components/ui/drawer";
import { LanguageSwitcherCircle } from "@/components/homepage/language-switcher-circle";

type NavItem = { href: string; label: string };

type MobileNavProps = {
  navItems: NavItem[];
  /** The "Machines" item's own real product categories, rendered as an
   * indented sub-list directly under it — same hrefs/labels as the
   * desktop dropdown (see PrimaryNav), just always visible here rather
   * than behind a hover/click disclosure, to keep the mobile menu simple. */
  machinesHref: string;
  machineCategories: NavItem[];
};

export function MobileNav({ navItems, machinesHref, machineCategories }: MobileNavProps) {
  const t = useTranslations("Nav");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <IconButton
        aria-label={t("openMenu")}
        onClick={() => setIsOpen(true)}
        variant="ghost-inverse"
        className="md:hidden"
      >
        <MenuIcon />
      </IconButton>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("menuTitle")} variant="dark">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <React.Fragment key={item.label}>
              <Link
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-(--radius-control) px-2 py-2.5 text-body-l text-text-inverse transition-colors duration-200 hover:bg-white/10"
              >
                {item.label}
              </Link>
              {item.href === machinesHref && machineCategories.length > 0 && (
                <div className="mb-2 flex flex-col gap-0.5 ps-4">
                  {machineCategories.map((category) => (
                    <Link
                      key={category.href}
                      href={category.href}
                      onClick={() => setIsOpen(false)}
                      className="rounded-(--radius-control) px-2 py-2 text-body-s text-text-inverse/70 transition-colors duration-200 hover:bg-white/10 hover:text-text-inverse"
                    >
                      {category.label}
                    </Link>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>
        <div className="mt-auto">
          <LanguageSwitcherCircle dropdown="up" />
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
