import { Link } from "@/i18n/navigation";

type DiscoveryTileProps = {
  href: string;
  label: string;
};

/**
 * Distinct from ProductCard by design — a category, not a product (no
 * price/condition/badge). No real photography exists yet, so this
 * renders a placeholder surface rather than an <Image>; swap in real
 * category imagery when it's available.
 */
export function DiscoveryTile({ href, label }: DiscoveryTileProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-(--radius-card) border border-border p-6 transition-colors duration-200 hover:border-border-strong"
    >
      <div className="aspect-[4/3] w-full rounded-(--radius-control) bg-bg" aria-hidden="true" />
      <span className="text-body-l font-medium text-text-primary">{label}</span>
    </Link>
  );
}
