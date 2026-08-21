"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Heading } from "@/components/ui/heading";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { cn } from "@/lib/design/cn";
import type { CatalogueProduct } from "@/lib/woocommerce/products";

type RelatedProductsProps = {
  products: CatalogueProduct[];
};

const ARROW_BUTTON =
  "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200";

/**
 * A horizontally-scrolling strip rather than the catalogue's ProductCard
 * grid: this carousel needs its own snap/scroll/arrow behavior that
 * ProductCard (shared with the catalogue and homepage) doesn't own, so
 * it's composed directly here — though the card's own content hierarchy
 * (brand → title → condition → price) deliberately mirrors ProductCard's
 * for visual consistency across the app. No carousel library: native
 * scroll-snap + scrollBy, matching this codebase's zero-dependency
 * convention for overlays/interactions elsewhere.
 *
 * Each card is a single bordered/backgrounded box (image + content share
 * one boundary) rather than a framed image floating over bare text —
 * the image itself carries no border/background/padding of its own
 * (no `frameClassName`), so there's only one visible frame per card, not
 * two nested ones.
 *
 * The image slot is a plain `aspect-[4/5]` — CSS `aspect-ratio` boxes
 * were tried and rejected earlier (a *variable*-ratio image forced into
 * a *fixed* box always leaves empty space along one axis; no amount of
 * CSS tuning fixes that for arbitrary source ratios). What makes a plain
 * ratio box safe here is that the image itself now requests
 * `mode="card"` — pre-composited server-side onto the exact same
 * `CANONICAL_PRODUCT_IMAGE_RATIO` canvas (see
 * lib/media/product-image-source.ts), so it always matches this slot's
 * shape by construction. The ratio problem was moved out of CSS
 * entirely rather than solved with another CSS value.
 */
export function RelatedProducts({ products }: RelatedProductsProps) {
  const t = useTranslations("Product");
  const catalogueT = useTranslations("Catalogue");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const updateScrollState = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // Chrome/Firefox report a negative scrollLeft at the RTL start —
    // the magnitude alone is enough to tell "at the start" from "at the
    // end" without branching on direction.
    const scrolled = Math.abs(el.scrollLeft);
    setCanScrollPrev(scrolled > 8);
    setCanScrollNext(scrolled < maxScroll - 8);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, products.length]);

  function scrollByDirection(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth * 0.8;
    const isRTL = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: (isRTL ? -direction : direction) * step, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Heading level={2} size="l">
          {t("relatedHeading")}
        </Heading>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => scrollByDirection(-1)}
            disabled={!canScrollPrev}
            aria-label={catalogueT("previous")}
            className={cn(
              ARROW_BUTTON,
              canScrollPrev ? "bg-text-primary text-text-inverse hover:opacity-90" : "bg-bg text-text-muted",
            )}
          >
            <ArrowIcon direction="prev" />
          </button>
          <button
            type="button"
            onClick={() => scrollByDirection(1)}
            disabled={!canScrollNext}
            aria-label={catalogueT("next")}
            className={cn(
              ARROW_BUTTON,
              canScrollNext ? "bg-text-primary text-text-inverse hover:opacity-90" : "bg-bg text-text-muted",
            )}
          >
            <ArrowIcon direction="next" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/machines/${product.slug}`}
            data-carousel-card
            className={cn(
              "group flex shrink-0 snap-start flex-col overflow-hidden rounded-(--radius-card) border border-border bg-surface",
              "basis-[80%] sm:basis-[46%] md:basis-[31%] lg:basis-[calc(25%-1.125rem)]",
            )}
          >
            <div className="relative flex aspect-[4/5] w-full min-h-0 shrink-0 items-center justify-center overflow-hidden">
              <ProductImage
                src={product.imageSrc}
                alt={product.imageAlt}
                mode="card"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 80vw"
                className="transition-transform duration-300 group-hover:scale-[1.03]"
                placeholderClassName="text-caption"
              />
            </div>

            <div className="flex flex-col gap-2 p-4">
              {product.brand && (
                <p className="text-caption tracking-wide text-text-muted uppercase">
                  <bdi>{product.brand}</bdi>
                </p>
              )}
              <h3 className="text-body-l font-medium text-text-primary">
                <bdi>{product.name}</bdi>
              </h3>
              {product.condition && (
                <p className="text-body-s text-text-secondary">{t(`condition.${product.condition}`)}</p>
              )}
              <div className="mt-auto pt-1">
                {product.available ? (
                  <Price amount={product.price} originalAmount={product.originalPrice} />
                ) : (
                  <span className="text-body-s text-text-muted">{t("outOfStock")}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "prev" | "next" }) {
  const d = direction === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 rtl:-scale-x-100" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
