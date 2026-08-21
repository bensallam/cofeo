import { NextResponse, type NextRequest } from "next/server";
import { decodeProductImageSource, isAllowedProductImageUrl } from "@/lib/media/product-image-source";
import { CACHE_CONTROL, getCardProductImage } from "@/lib/media/product-image-pipeline";

/**
 * Serves the "card" variant: the same trim as ../[encoded]/route.ts,
 * then composited onto the shared `CANONICAL_PRODUCT_IMAGE_RATIO` canvas
 * (see lib/media/product-image-source.ts) with a neutral, opaque
 * background — so every image requested this way arrives at an
 * identical aspect ratio, and the frontend slot for it can be a plain
 * `aspect-*` box with no per-image gap math. Only ProductCard and
 * Related Products use this; ProductGallery and everywhere else keeps
 * requesting the plain ../[encoded]/route.ts (natural ratio, no canvas).
 *
 * Same allowlist/SSRF check as the natural route — this is not a new
 * security boundary, it's the same one, reused.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ encoded: string }> }) {
  const { encoded } = await params;
  const src = decodeProductImageSource(encoded);

  if (!src || !isAllowedProductImageUrl(src)) {
    return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await getCardProductImage(src);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    // Upstream unreachable or otherwise failed end-to-end — fall back to
    // the original image untrimmed/uncomposited rather than showing
    // nothing. The card slot still handles a non-4:5 image gracefully
    // (object-contain, centered), it just won't have the canvas fill.
    return NextResponse.redirect(src);
  }
}
