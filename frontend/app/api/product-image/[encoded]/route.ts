import { NextResponse, type NextRequest } from "next/server";
import { decodeProductImageSource, isAllowedProductImageUrl } from "@/lib/media/product-image-source";
import { CACHE_CONTROL, getNaturalProductImage } from "@/lib/media/product-image-pipeline";

/**
 * Serves WooCommerce product photos with their dead outer canvas trimmed
 * away — never their source pixels edited. The original stays exactly as
 * WordPress has it; this only ever reads it, then hands ProductImage a
 * cropped-to-content derivative at the product's own natural aspect
 * ratio (used by ProductGallery and everywhere else that isn't a
 * fixed-slot grid — see ../card/[encoded]/route.ts for the composited
 * variant those contexts use instead).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ encoded: string }> }) {
  const { encoded } = await params;
  const src = decodeProductImageSource(encoded);

  if (!src || !isAllowedProductImageUrl(src)) {
    return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await getNaturalProductImage(src);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    // Upstream unreachable or otherwise failed end-to-end — fall back to
    // the original image untrimmed rather than showing nothing.
    return NextResponse.redirect(src);
  }
}
