import { cn } from "@/lib/design/cn";

type CardProps = React.ComponentPropsWithoutRef<"div"> & {
  elevated?: boolean;
};

/** Thin border by default; shadow only for the rare truly-elevated case. */
export function Card({ elevated = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-(--radius-card) bg-surface p-6",
        elevated ? "shadow-(--shadow-elevated)" : "border border-border",
        className || null,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
