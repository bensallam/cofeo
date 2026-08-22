import { cn } from "@/lib/design/cn";

const SPACING = {
  sm: "py-[clamp(2rem,5vw,3.5rem)]",
  md: "py-[clamp(3rem,8vw,6rem)]",
  lg: "py-[clamp(4rem,12vw,9rem)]",
} as const;

type SectionProps = React.ComponentPropsWithoutRef<"section"> & {
  spacing?: keyof typeof SPACING;
  /** "dark" scopes the premium dark/gold theme (see tokens.css's
   * `[data-theme="dark"]` block) to this section and everything inside
   * it — every semantic color utility already in use (bg-surface,
   * text-text-primary, border-border, ...) repaints automatically, no
   * per-component changes needed. Defaults to "light" (unchanged)
   * everywhere else, including every existing Home page Section. */
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
      data-theme={tone === "dark" ? "dark" : undefined}
      className={cn(
        SPACING[spacing],
        tone === "dark" && "bg-bg text-text-primary",
        className || null,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
