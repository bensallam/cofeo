import { cn } from "@/lib/design/cn";

type ContainerProps = React.ComponentPropsWithoutRef<"div">;

/**
 * Max-width + fluid gutter wrapper. Gutter scales smoothly with
 * viewport width (1rem → 3rem) instead of jumping at breakpoints.
 */
export function Container({ className, children, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-(--container-max) px-[clamp(1rem,4vw,3rem)]",
        className || null,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
