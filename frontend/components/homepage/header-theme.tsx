"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/design/cn";

const HeaderThemeContext = React.createContext<"light" | "dark">("light");

/** Read by MobileNav/CartWidget so their own (portaled) Drawer can match
 * the header pill's theme — a portal escapes the DOM subtree the
 * `data-theme="dark"` attribute below is set on, so plain CSS custom
 * property inheritance can't reach it; this Context carries the same
 * decision across that gap instead. */
export function useHeaderTheme() {
  return React.useContext(HeaderThemeContext);
}

const LIGHT_PILL = "border border-border bg-surface/80 shadow-(--shadow-elevated) backdrop-blur-xl";
const DARK_PILL =
  "border border-white/[0.16] bg-white/[0.055] shadow-(--shadow-elevated) backdrop-blur-xl";

/**
 * The nav pill's own theme — independent of every other page's tokens,
 * because the header is one shared component rendered above every
 * route (see app/[locale]/layout.tsx), but only the Home route ("/")
 * gets the dark "inflated glass" treatment; everywhere else it's the
 * light glass matching that page's own (warm-neutral) tokens.
 *
 * `data-theme="dark"` set here cascades to every semantic-token-based
 * descendant rendered as `children` (PrimaryNav, LanguageSwitcherCircle,
 * CartWidget's icon, MobileNav's trigger) automatically — same
 * mechanism as Section's `tone` prop, just route-driven instead of
 * page-driven.
 */
export function HeaderThemeShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <HeaderThemeContext.Provider value={isHome ? "dark" : "light"}>
      <div
        data-theme={isHome ? "dark" : undefined}
        className={cn(
          "relative flex h-16 items-center justify-between gap-4 overflow-hidden rounded-full px-5 sm:px-8",
          isHome ? DARK_PILL : LIGHT_PILL,
          className || null,
        )}
      >
        {/* Soft inner highlight — a faint top-down sheen, what reads as
            "inflated glass" rather than a flat tinted rectangle. Only on
            the dark Home pill: on the light pages a highlight this size
            would just look like a visible smudge on an already-bright
            surface. */}
        {isHome && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/[0.05] to-transparent"
          />
        )}
        {children}
      </div>
    </HeaderThemeContext.Provider>
  );
}

/**
 * The `cofeo-logo.png` asset is white-on-transparent, drawn for a dark
 * surface. On the Home pill (dark glass) it sits bare. Everywhere else
 * the pill is light glass, where a plain white mark would be invisible
 * — so on every other route it gets a small charcoal chip behind it
 * (`bg-text-primary`, which resolves to the light scope's soft-charcoal
 * token), the same asset with no distortion, just given something to
 * sit on.
 */
export function HeaderLogo() {
  const theme = useHeaderTheme();
  const logo = (
    // eslint-disable-next-line @next/next/no-img-element -- see header.tsx's own doc comment on why this is a plain <img>
    <img src="/cofeo-logo.png" alt="COFEO" width={780} height={243} className="h-7 w-auto sm:h-8" />
  );

  if (theme === "dark") {
    return (
      <Link href="/" className="shrink-0">
        {logo}
      </Link>
    );
  }

  return (
    <Link href="/" className="shrink-0 rounded-full bg-text-primary py-2 pe-4 ps-3 sm:py-2.5 sm:pe-5 sm:ps-4">
      {logo}
    </Link>
  );
}
