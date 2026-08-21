import { cn } from "@/lib/design/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** No icon library is installed by design — pass an inline SVG if needed. */
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-16 text-center",
        className || null,
      )}
    >
      {icon && (
        <div className="text-text-muted" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-body-l font-medium text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-body-s text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
