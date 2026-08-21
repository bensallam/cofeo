type SkipLinkProps = {
  label: string;
  targetId: string;
};

/**
 * Visually hidden until focused. Must be the first focusable element
 * in the document for keyboard users to reach it before the header nav.
 */
export function SkipLink({ label, targetId }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="fixed start-4 top-4 z-[100] -translate-y-20 rounded-(--radius-control) bg-surface px-4 py-2.5 text-body-s font-medium text-text-primary shadow-(--shadow-elevated) transition-transform duration-200 focus:translate-y-0"
    >
      {label}
    </a>
  );
}
