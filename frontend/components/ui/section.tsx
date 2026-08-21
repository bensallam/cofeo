import { cn } from "@/lib/design/cn";

const SPACING = {
  sm: "py-[clamp(2rem,5vw,3.5rem)]",
  md: "py-[clamp(3rem,8vw,6rem)]",
  lg: "py-[clamp(4rem,12vw,9rem)]",
} as const;

type SectionProps = React.ComponentPropsWithoutRef<"section"> & {
  spacing?: keyof typeof SPACING;
};

/** Vertical rhythm wrapper — the only place section padding-block is set. */
export function Section({
  spacing = "md",
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn(SPACING[spacing], className || null)} {...props}>
      {children}
    </section>
  );
}
