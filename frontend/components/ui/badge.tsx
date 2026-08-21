import { cn } from "@/lib/design/cn";

const VARIANT = {
  neutral: "border-border-strong text-text-primary",
  success: "border-success text-success bg-success-surface",
  warning: "border-warning text-warning bg-warning-surface",
  error: "border-error text-error bg-error-surface",
} as const;

type BadgeProps = React.ComponentPropsWithoutRef<"span"> & {
  variant?: keyof typeof VARIANT;
};

/** Small, rectangular, editorial — not a rounded "pill". */
export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-(--radius-control) border px-2 py-0.5",
        "text-caption font-medium tracking-wide uppercase",
        VARIANT[variant],
        className || null,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
