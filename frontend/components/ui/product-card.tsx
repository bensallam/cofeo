import { useTranslations } from "next-intl";
import { Price } from "./price";
import { Badge } from "./badge";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/design/cn";

type Condition = "new" | "excellent" | "very-good" | "good";

type ProductCardProps = {
  imageSrc?: string;
  imageAlt: string;
  brand: string;
  name: string;
  condition?: Condition;
  price: number | null;
  originalPrice?: number;
  badgeLabel?: string;
  available?: boolean;
  warranty?: boolean;
  className?: string;
};

/**
 * The image dominates the composition by design (per brief) — text
 * block below is deliberately compact. A glass card frame (subtle
 * border + translucent surface) gives the card its own boundary on a
 * dark page, where the old borderless/shadowless treatment (relying on
 * grid gap + a light page bg alone) had nothing to read against; the
 * image itself is unchanged — still edge-to-edge in its own 4:5 slot,
 * still the dominant element, just clipped by the card's own radius
 * now instead of carrying its own.
 */
export function ProductCard({
  imageSrc,
  imageAlt,
  brand,
  name,
  condition,
  price,
  originalPrice,
  badgeLabel,
  available = true,
  warranty = false,
  className,
}: ProductCardProps) {
  const t = useTranslations("Product");

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-(--radius-card) border border-border bg-surface/40 backdrop-blur-xl backdrop-saturate-150 transition-colors duration-200 hover:border-gold/40",
        className || null,
      )}
    >
      <div className="relative flex aspect-[4/5] w-full min-h-0 items-center justify-center">
        {/* mode="card" images are pre-composited server-side onto a
            CANONICAL_PRODUCT_IMAGE_RATIO (4:5) canvas — exactly matching
            this slot's own ratio, so the image fills it edge-to-edge with
            no gap. frameClassName carries no rounding of its own: the
            <article> above now clips via its own overflow-hidden, so a
            second radius here would just double up. `bg-bg` stays only
            for the placeholder branch — for a real image it's fully
            covered, invisible, harmless. */}
        <ProductImage
          src={imageSrc}
          alt={imageAlt}
          mode="card"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          frameClassName="bg-bg"
          placeholderClassName="text-caption"
        />
        {badgeLabel && (
          <Badge variant="neutral" className="absolute top-3 start-3 bg-surface">
            {badgeLabel}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          {/* <bdi> isolates brand/name from the surrounding bidi context —
              without it, a bracketed marker like "[TEST] Inissia" gets
              visually reordered to "Inissia [TEST]" under RTL, because the
              bracket is a neutral character the bidi algorithm treats as a
              run boundary between the two Latin segments. Real product
              names with parentheticals (e.g. "Vertuo Next (2023)") would
              hit the same bug, so this isn't a demo-data-only fix. */}
          <p className="text-caption tracking-wide text-text-muted uppercase">
            <bdi>{brand}</bdi>
          </p>
          <h3 className="text-body-l font-medium text-text-primary">
            <bdi>{name}</bdi>
          </h3>
          {condition && (
            <p className="text-body-s text-text-secondary">{t(`condition.${condition}`)}</p>
          )}
        </div>

        {/* Stacked, not a side-by-side row: a sale price + strikethrough
            original already fills a narrow card column on its own — adding
            a warranty label to the same row caused it to overflow into the
            next grid column (caught in visual QA). */}
        <div className="flex flex-col gap-1">
          {available ? (
            <Price amount={price} originalAmount={originalPrice} />
          ) : (
            <span className="text-body-s text-text-muted">{t("outOfStock")}</span>
          )}
          {warranty && available && (
            <span className="text-caption text-text-muted">{t("warranty")}</span>
          )}
        </div>
      </div>
    </article>
  );
}
