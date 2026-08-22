import { cn } from "@/lib/design/cn";

type IconButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  /** Required — an icon-only button with no accessible name is a WCAG failure. */
  "aria-label": string;
  variant?: "default" | "ghost";
};

export function IconButton({
  variant = "ghost",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-(--radius-control) transition-colors duration-200",
        variant === "default" &&
          "bg-button-primary-bg text-button-primary-text hover:bg-button-primary-bg-hover",
        variant === "ghost" && "text-text-primary hover:bg-surface-hover",
        "disabled:pointer-events-none disabled:opacity-40",
        className || null,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
