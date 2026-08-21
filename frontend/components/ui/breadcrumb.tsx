import { Link } from "@/i18n/navigation";

type BreadcrumbItem = {
  label: string;
  /** Omitted for the current page — rendered as plain text, not a link. */
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  label: string;
};

export function Breadcrumb({ items, label }: BreadcrumbProps) {
  return (
    <nav aria-label={label} className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-body-s text-text-muted">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 && <ChevronIcon />}
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors duration-200 hover:text-text-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-text-primary">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-3.5 rtl:-scale-x-100"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  );
}
