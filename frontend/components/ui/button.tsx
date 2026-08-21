import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/design/cn";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-control) text-body-s font-medium " +
  "transition-colors duration-200 ease-(--ease-precise) " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "px-4 py-2.5";

const VARIANT = {
  primary:
    "bg-button-primary-bg text-button-primary-text hover:bg-button-primary-bg-hover active:bg-button-primary-bg-hover",
  secondary:
    "bg-button-secondary-bg text-button-secondary-text border border-button-secondary-border hover:bg-surface-hover",
  ghost: "bg-transparent text-text-primary hover:bg-surface-hover",
  destructive: "bg-error text-text-inverse hover:opacity-90",
} as const;

type ButtonVariant = keyof typeof VARIANT;

type ButtonProps = Omit<React.ComponentPropsWithoutRef<"button">, "children"> & {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Renders as a Link instead of a <button> — never nest a Link inside
   * Button's own <button> element, that's invalid HTML. */
  href?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  loading = false,
  href,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(BASE, VARIANT[variant], className || null);

  if (href !== undefined) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
