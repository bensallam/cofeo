"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/design/cn";

type NavItem = { href: string; label: string };

type PrimaryNavProps = {
  ariaLabel: string;
  /** Rendered before the "Machines" dropdown item (currently just Home). */
  leadingItems: NavItem[];
  machinesHref: string;
  machinesLabel: string;
  machineCategories: NavItem[];
  otherItems: NavItem[];
};

const NAV_LINK =
  "text-body-s text-text-inverse transition-colors duration-200 hover:text-text-inverse/70";

/**
 * Only the "Machines" item gets a dropdown — `leadingItems` (Home) and
 * `otherItems` (Used, Services) stay plain links, same hrefs/behavior as
 * before this redesign. The dropdown lists COFEO's actual product
 * categories (the same three used by the Homepage's "Find your machine"
 * tiles and the Catalogue sidebar — see lib/demo-data usage in
 * app/[locale]/page.tsx), not the reference design's own sub-brand names
 * (Nespresso, Dolce Gusto, Accessories), which aren't part of this app's
 * real category data. Likewise there's no Boutique/À propos/Contact item:
 * this app has no distinct shop landing separate from /machines and no
 * about/contact pages — see the Header component's own doc comment.
 *
 * Dropdown panel is glass (translucent dark + backdrop-blur), matching
 * the header pill itself — see header.tsx.
 *
 * Opens on hover (desktop pointer) and on click of the chevron button
 * (keyboard/touch accessible — a real <button> with aria-expanded), closes
 * on Escape, click-outside, or selecting an item. The "Machines" link
 * itself keeps navigating straight to /machines exactly as before —
 * the dropdown is a purely additive shortcut layered on top of it, not a
 * replacement for the existing link/behavior.
 */
export function PrimaryNav({
  ariaLabel,
  leadingItems,
  machinesHref,
  machinesLabel,
  machineCategories,
  otherItems,
}: PrimaryNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNow = React.useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  }, []);

  const closeSoon = React.useCallback(() => {
    closeTimer.current = setTimeout(() => setIsOpen(false), 120);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const isMachinesActive = pathname === machinesHref || pathname.startsWith(`${machinesHref}/`);

  return (
    <nav className="hidden items-center gap-8 md:flex" aria-label={ariaLabel}>
      {leadingItems.map((item) => (
        <Link key={item.href} href={item.href} className={NAV_LINK}>
          {item.label}
        </Link>
      ))}

      <div ref={containerRef} className="relative" onMouseEnter={openNow} onMouseLeave={closeSoon}>
        <div className="flex items-center gap-1">
          <Link href={machinesHref} className={cn(NAV_LINK, isMachinesActive && "font-medium text-text-inverse")}>
            {machinesLabel}
          </Link>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label={machinesLabel}
            onClick={() => setIsOpen((open) => !open)}
            className="text-text-inverse/60 transition-colors duration-200 hover:text-text-inverse"
          >
            <ChevronIcon open={isOpen} />
          </button>
        </div>

        {isOpen && (
          <div
            role="menu"
            className="absolute start-0 top-full z-20 mt-3 w-56 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/25 bg-gray-1000/60 py-1 shadow-(--shadow-elevated) backdrop-blur-xl backdrop-saturate-150"
          >
            {machineCategories.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 text-body-s text-text-inverse/85 transition-colors duration-200 hover:bg-white/10 hover:text-text-inverse"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {otherItems.map((item) => (
        <Link key={item.href} href={item.href} className={NAV_LINK}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}
