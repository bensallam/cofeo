import { cn } from "@/lib/design/cn";

type DividerProps = React.ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
};

/**
 * `role="separator"` rather than `<hr>` — `<hr>` has no native vertical
 * variant, and this needs to support both orientations uniformly.
 */
export function Divider({ orientation = "horizontal", className, ...props }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "border-border",
        orientation === "horizontal" ? "w-full border-t" : "h-full border-s",
        className || null,
      )}
      {...props}
    />
  );
}
