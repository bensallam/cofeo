import { cn } from "@/lib/design/cn";

const SPACING = {
  sm: "py-[clamp(2rem,5vw,3.5rem)]",
  md: "py-[clamp(3rem,8vw,6rem)]",
  lg: "py-[clamp(4rem,12vw,9rem)]",
} as const;

type SectionProps = React.ComponentPropsWithoutRef<"section"> & {
  spacing?: keyof typeof SPACING;
  /** COFEO ships a single light, warm palette (see tokens.css) — there is
   * no separate dark theme to scope anymore. "dark" is kept only so the
   * Catalogue/Product/Cart/Checkout routes that pass it don't need a
   * separate edit; it just explicitly repaints the section with the same
   * ambient tokens (bg-bg/text-text-primary) every page already inherits,
   * a no-op in practice. */
  tone?: "light" | "dark";
};

/** Vertical rhythm wrapper — the only place section padding-block is set. */
export function Section({
  spacing = "md",
  tone = "light",
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(SPACING[spacing], tone === "dark" && "bg-bg text-text-primary", className || null)}
      {...props}
    >
      {children}
    </section>
  );
}
