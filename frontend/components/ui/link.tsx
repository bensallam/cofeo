import { Link as LocaleLink } from "@/i18n/navigation";
import { cn } from "@/lib/design/cn";

type LinkProps = React.ComponentPropsWithoutRef<typeof LocaleLink> & {
  variant?: "default" | "muted";
};

/** Locale-aware link (wraps next-intl's Link) with COFEO's underline treatment. */
export function Link({ variant = "default", className, children, ...props }: LinkProps) {
  return (
    <LocaleLink
      className={cn(
        "underline decoration-1 underline-offset-4 transition-colors duration-200",
        variant === "default"
          ? "text-text-primary hover:text-text-secondary"
          : "text-text-muted hover:text-text-primary",
        className || null,
      )}
      {...props}
    >
      {children}
    </LocaleLink>
  );
}
