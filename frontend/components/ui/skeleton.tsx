import { cn } from "@/lib/design/cn";

type SkeletonProps = React.ComponentPropsWithoutRef<"div">;

/** `animate-pulse` already respects prefers-reduced-motion globally (app/styles/tokens.css). */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-(--radius-control) bg-border", className || null)}
      aria-hidden="true"
      {...props}
    />
  );
}
