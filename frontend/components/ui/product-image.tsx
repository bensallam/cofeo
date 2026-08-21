"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { buildProductImageUrl, type ProductImageMode } from "@/lib/media/product-image-source";
import { cn } from "@/lib/design/cn";

type ProductImageProps = {
  /** Undefined/empty renders the shared "no image" fallback. */
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** "natural" (default): trimmed image at its own aspect ratio — what
   * every caller used before "card" mode existed, unchanged. "card":
   * requests the pre-composited CANONICAL_PRODUCT_IMAGE_RATIO canvas
   * variant instead, for the two contexts (ProductCard, Related
   * Products) where every image in a row/grid must share identical slot
   * dimensions — see lib/media/product-image-source.ts and
   * app/api/product-image/card/[encoded]/route.ts. Never pass "card" to
   * a caller that lets the image define its own footprint (the gallery,
   * thumbnails, cart/checkout line items); the whole point there is the
   * image's own ratio, which "card" replaces with a fixed one. */
  mode?: ProductImageMode;
  /** The card/frame drawn around the image — background, border,
   * rounded corners, padding. Applied directly on the `<img>` itself
   * (background/padding/border/radius are ordinary box-model properties,
   * valid on a replaced element) rather than on a wrapper `<div>`, so it
   * always hugs exactly the image's own ratio-capped footprint with no
   * intermediate box to get out of sync. A wrapper div was tried and
   * rejected twice: `inline-flex` hands the `<img>`'s sizing to the flex
   * algorithm (stretch/shrink independently per axis), which ignores its
   * aspect ratio; `inline-block` avoids that but is itself an auto-height
   * box, and a percentage `max-height` on a *child* can't resolve against
   * an *auto*-height ancestor (a well-known CSS circularity — the
   * ancestor's height depends on the child's content, so the browser
   * treats the percentage as `none` for that computation) — the `<img>`
   * would then overflow the wrapper's own max-height instead of being
   * capped by it. Styling the `<img>` directly sidesteps the circularity
   * entirely: its `max-h-full`/`max-w-full` resolve against the caller's
   * slot, which is always a genuinely definite-height box. Omit for
   * contexts where the caller's own element already provides this (e.g.
   * a thumbnail button's active-state border, which must span the full
   * clickable hit area). */
  frameClassName?: string;
  /** Extra classes for the <Image> itself (e.g. a hover transform). */
  className?: string;
  /** Extra classes for the fallback text (callers own font-size/alignment
   * since the tiny fixed-size thumbnails need smaller type than a full
   * card image) — never pass a conflicting text-color here. */
  placeholderClassName?: string;
};

// Used only until the real trimmed image has loaded and reported its
// natural size (see onLoad below) — close to a typical portrait product
// shot so the very first paint isn't wildly different from the eventual
// real ratio once it's known.
const PLACEHOLDER_WIDTH = 800;
const PLACEHOLDER_HEIGHT = 1000;

/**
 * The single place every WooCommerce product photo is rendered from.
 *
 * `src` is routed through `/api/product-image`, which fetches the
 * original from WordPress (never modifying it) and returns it with dead
 * outer canvas trimmed via sharp, cached — see that route for why (CSS
 * `object-fit` can't tell "empty canvas" from "meaningful composition",
 * only the trim step can).
 *
 * What happens *after* trimming is what this component owns: the box
 * must fit the trimmed image's own aspect ratio, not force it into an
 * unrelated fixed ratio. A fixed box + `object-contain` still draws that
 * box's full background/border around whatever empty space is left when
 * the image's ratio doesn't match the box's — exactly the "large blank
 * bars inside a visible frame" this replaces. Instead: `next/image` is
 * used in its plain `width`/`height` mode (not `fill`), which renders a
 * real `<img>` with those as HTML attributes; combined with `h-auto
 * w-auto max-h-full max-w-full`, the browser's native replaced-element
 * sizing (the same mechanism responsive `<img>`s have used for decades)
 * scales the image down to fit the available space while preserving its
 * own ratio — no CSS `aspect-ratio` math to get subtly wrong. The
 * decorative frame (`frameClassName`) is applied straight onto the
 * `<img>` (see the prop doc below for why no wrapper div sits between
 * it and the caller's slot), so it always hugs the image's actual
 * rendered footprint instead of stretching to the caller's full slot.
 * The real dimensions aren't known until the
 * image has loaded once (an `onLoad` reads `naturalWidth`/`naturalHeight`
 * off the underlying `<img>`), so the very first paint uses a neutral
 * placeholder ratio that gets replaced a moment later.
 *
 * That reasoning is why a *forced* CSS box (a fixed `aspect-*` on the
 * caller's slot) was always wrong for a *variable*-ratio image — but
 * ProductCard and Related Products still need every image in a row to
 * occupy an identical slot, and no CSS technique can do that for
 * arbitrary source ratios without cropping or distorting something
 * (provable: `object-contain` in a fixed box always leaves empty space
 * along whichever axis a mismatched ratio doesn't fill — that's not a
 * bug, it's what "don't crop, don't stretch" *means* geometrically for
 * two different rectangles). `mode="card"` resolves this upstream of
 * CSS instead: the server composites the trimmed product onto a fixed
 * `CANONICAL_PRODUCT_IMAGE_RATIO` canvas before it ever reaches the
 * browser, so the *image itself* now has the ratio the grid needs, and
 * the caller's slot can go back to being a plain, boring `aspect-*` box
 * with no gap math. See lib/media/product-image-source.ts and
 * app/api/product-image/card/[encoded]/route.ts.
 *
 * Falls back to the real Product.imagePlaceholder copy everywhere a line
 * item/product genuinely has no image, instead of five call sites each
 * re-implementing the same conditional.
 */
export function ProductImage({ src, alt, sizes, priority, mode = "natural", frameClassName, className, placeholderClassName }: ProductImageProps) {
  const t = useTranslations("Product");
  const [dims, setDims] = React.useState({ width: PLACEHOLDER_WIDTH, height: PLACEHOLDER_HEIGHT });

  if (!src) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center text-text-muted",
          frameClassName,
          placeholderClassName,
        )}
      >
        {t("imagePlaceholder")}
      </div>
    );
  }

  return (
    <Image
      src={buildProductImageUrl(src, mode)}
      alt={alt}
      width={dims.width}
      height={dims.height}
      priority={priority}
      sizes={sizes}
      className={cn("h-auto max-h-full w-auto max-w-full object-contain", frameClassName, className)}
      onLoad={(event) => {
        const img = event.currentTarget;
        if (img.naturalWidth && img.naturalHeight) {
          setDims({ width: img.naturalWidth, height: img.naturalHeight });
        }
      }}
    />
  );
}
