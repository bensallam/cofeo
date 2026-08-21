import { cn } from "@/lib/design/cn";

type ErrorStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Presentational only — resolving an AppError code (lib/errors) to a
 * localized title/description happens at the call site, not here.
 */
export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 py-16 text-center",
        className || null,
      )}
    >
      <p className="text-body-l font-medium text-error">{title}</p>
      {description && <p className="max-w-sm text-body-s text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
