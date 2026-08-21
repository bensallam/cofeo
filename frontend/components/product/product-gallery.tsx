"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ProductImage } from "@/components/ui/product-image";
import { cn } from "@/lib/design/cn";

type GalleryImage = { src: string; alt: string };

type ProductGalleryProps = {
  images: GalleryImage[];
};

const NAV_BUTTON =
  "absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full " +
  "bg-surface/90 text-text-primary shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors duration-200 " +
  "hover:bg-surface disabled:pointer-events-none disabled:opacity-40";

/**
 * No carousel/lightbox dependency — a small local state swap plus
 * next/image covers everything needed here. Falls back to the same
 * placeholder pattern already used in ProductCard/DiscoveryTile when
 * a product has no images (true for all current demo data).
 *
 * The image is width-driven, not height-capped: the frame below is a
 * plain block (no `flex`, no `max-h`, no `aspect-*`), and `ProductImage`
 * is given `min-w-full` on top of its own existing `max-w-full` base
 * class. `min-width` and `max-width` both pinned to 100% clamp the
 * *used* width to exactly the frame's content width regardless of the
 * image's own intrinsic/decoded resolution — this doesn't depend on
 * which of the base `w-auto` / the added `w-full` "wins" a cascade order
 * fight (this file's `cn()` is a plain join with no dedup, so that order
 * isn't something to rely on); min/max clamping is a separate,
 * always-applied step in the CSS box model. `h-auto` (already on
 * ProductImage) then derives the height from the image's own aspect
 * ratio at that width — no fixed `aspect-*`, so a portrait photo doesn't
 * get letterboxed and a landscape one doesn't get cropped.
 *
 * A `scale-[0.98]` sits on top of that full-width box — a deliberate,
 * very subtle amount of extra breathing room beyond the frame's own
 * `p-[5px]`, requested after the plain 100%-width version still read as
 * marginally too tight against the frame edge in a side-by-side
 * comparison. Two other approaches were tried and rejected for this
 * specific ask first: shrinking the image via a width *percentage*
 * (e.g. 98% + `mx-auto`) changes the image's real layout box, and since
 * the frame's height is auto (driven by the image's rendered height),
 * that shrinks the *frame's* height too — directly violating "don't
 * change the frame's dimensions." A `p-[5px]` increase was already
 * rejected in an earlier round as the wrong composition. `scale()`
 * doesn't participate in layout at all, so the frame's own auto-height
 * (still computed from the image's *pre-scale* box) and its `w-full`
 * width are both completely unaffected in either dimension — only the
 * image's painted pixels shrink, uniformly, symmetrically, on all four
 * sides. At 0.9 (an earlier, much larger round) this mismatch between a
 * visually-shrunk image and an unshrunk frame read as "too much empty
 * space"; at 0.98 the same mechanism produces a few extra pixels of
 * margin per side — the degree was the problem before, not the
 * mechanism itself.
 *
 * A `w-fit` + `max-h-[560px]` variant was tried and rejected here: it
 * fixed the *empty-space-around-a-fixed-box* version of this bug, but
 * produced the wrong composition entirely — a narrow, height-capped
 * image floating inside a bordered white card. The card border/padding
 * itself wasn't the problem; it was later removed too, which overcorrected
 * into "no visible frame at all." The current version reinstates a single
 * bordered frame — small fixed padding (`p-[5px]`), border, radius —
 * scoped to *only* the main-image block, not the whole gallery: the
 * thumbnail row is a sibling below it, outside this frame, each
 * thumbnail keeping its own separate border. No `frameClassName` is
 * passed to `ProductImage` here, so there's exactly one visible frame
 * (this div's border), not a frame-inside-a-frame.
 *
 * `p-[5px]` on the frame is a single, literal inset between the frame
 * border and the image (not layered on top of a separate larger frame
 * padding from an earlier round).
 *
 * Navigation is a plain index clamp, not circular: nothing in this
 * component previously wrapped around at the ends (thumbnail clicks
 * jump straight to an index), so the arrows don't invent that behavior.
 */
export function ProductGallery({ images }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const t = useTranslations("Product");
  const catalogueT = useTranslations("Catalogue");

  if (images.length === 0) {
    return (
      <div className="rounded-(--radius-card) border border-border bg-surface p-4 sm:p-6">
        <div className="flex aspect-[4/5] w-full items-center justify-center rounded-(--radius-card) bg-bg text-caption text-text-muted">
          {t("imagePlaceholder")}
        </div>
      </div>
    );
  }

  const active = images[activeIndex];
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < images.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full rounded-(--radius-card) border border-border p-[5px]">
        <ProductImage
          src={active.src}
          alt={active.alt}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="block w-full min-w-full scale-[0.98]"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              disabled={!canGoPrev}
              aria-label={catalogueT("previous")}
              className={cn(NAV_BUTTON, "start-3")}
            >
              <NavArrowIcon direction="prev" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.min(images.length - 1, i + 1))}
              disabled={!canGoNext}
              aria-label={catalogueT("next")}
              className={cn(NAV_BUTTON, "end-3")}
            >
              <NavArrowIcon direction="next" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={t("galleryImageLabel", { index: index + 1, total: images.length })}
              className={cn(
                "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-control) border transition-colors duration-200",
                index === activeIndex ? "border-text-primary" : "border-border",
              )}
            >
              <ProductImage src={image.src} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavArrowIcon({ direction }: { direction: "prev" | "next" }) {
  const d = direction === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 rtl:-scale-x-100" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
