import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { CANONICAL_PRODUCT_IMAGE_RATIO } from "./product-image-source";

/**
 * Server-only. Shared by both /api/product-image routes (natural + card)
 * so the fetch/disk-cache/in-flight-dedupe plumbing exists in exactly one
 * place — the two routes differ only in the `sharp` transform they apply
 * to the fetched original, never in how they fetch or cache it. Never
 * imported by client code (ProductImage.tsx only imports the plain
 * constants/URL-builder from ./product-image-source, not this file) —
 * `sharp` is a native binding and would break the client bundle.
 *
 * Threshold chosen from testing against real COFEO product photos: 20 is
 * high enough to strip the large flat-color margins the AI-generated
 * promo shots ship with (Pixie: 1254×1254 → 591×1108, no logo/text/machine
 * lost), while being low enough that a real, textured lifestyle photo
 * (WhatsApp-Image-...jpeg, mottled fabric background) comes back
 * completely untouched instead of having real content shaved off its
 * edges. Unchanged by the card-canvas addition below — card mode trims
 * with this exact same value before compositing, it doesn't get its own.
 */
export const TRIM_THRESHOLD = 20;
export const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

const CACHE_DIR = path.join(os.tmpdir(), "cofeo-product-image-trim-cache");

/**
 * The canonical card canvas, in pixels — width picked as a round, high
 * enough number to stay sharp on large desktop cards; height derived so
 * the canvas is exactly `CANONICAL_PRODUCT_IMAGE_RATIO` (see
 * ./product-image-source, the single shared source of truth so the
 * route and the frontend's slot CSS can't drift apart).
 */
const CARD_CANVAS_WIDTH = 1000;
const CARD_CANVAS_HEIGHT = Math.round(CARD_CANVAS_WIDTH / CANONICAL_PRODUCT_IMAGE_RATIO);

/**
 * Sharp needs real RGB, not a CSS custom property — this must be kept in
 * sync by hand with `--color-gray-50` / `--color-bg` in
 * app/styles/tokens.css (currently #f5f5f2, "warm white"). There is no
 * way to share this value with the stylesheet across the server/CSS
 * boundary; if that token ever changes, update this too.
 */
const CARD_CANVAS_BACKGROUND = { r: 0xf5, g: 0xf5, b: 0xf2 };

export type ProductImageVariant = "natural" | "card";
type CachedImage = { buffer: Buffer; contentType: string };

// Per-process de-dupe: two concurrent requests for the same source+variant
// (e.g. the catalogue grid and a related-products card loading the same
// product at once) share one fetch+process instead of racing.
const inFlight = new Map<string, Promise<CachedImage>>();

function cacheKeyFor(variant: ProductImageVariant, sourceUrl: string): string {
  // Natural keeps its original, pre-existing key shape (no prefix) so
  // already-warm disk cache entries from before card mode existed stay
  // valid. Card's key folds in the canvas ratio and background so a
  // future change to either naturally invalidates old cached composites
  // instead of silently serving a stale canvas shape/color.
  const input =
    variant === "natural"
      ? sourceUrl
      : `card:${CANONICAL_PRODUCT_IMAGE_RATIO}:${CARD_CANVAS_BACKGROUND.r},${CARD_CANVAS_BACKGROUND.g},${CARD_CANVAS_BACKGROUND.b}:${sourceUrl}`;
  return createHash("sha256").update(input).digest("hex");
}

async function readFromDiskCache(key: string): Promise<CachedImage | null> {
  try {
    const [buffer, metaRaw] = await Promise.all([
      readFile(path.join(CACHE_DIR, `${key}.bin`)),
      readFile(path.join(CACHE_DIR, `${key}.json`), "utf-8"),
    ]);
    const meta = JSON.parse(metaRaw) as { contentType: string };
    return { buffer, contentType: meta.contentType };
  } catch {
    return null;
  }
}

async function writeToDiskCache(key: string, image: CachedImage): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await Promise.all([
      writeFile(path.join(CACHE_DIR, `${key}.bin`), image.buffer),
      writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify({ contentType: image.contentType })),
    ]);
  } catch {
    // A cache write failure just means the next request pays the
    // processing cost again — never a reason to fail the response we
    // already have.
  }
}

async function fetchOriginal(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const upstream = await fetch(sourceUrl);
  if (!upstream.ok) {
    throw new Error(`Upstream product image fetch failed: ${upstream.status}`);
  }
  const contentType = upstream.headers.get("content-type") ?? "image/png";
  return { buffer: Buffer.from(await upstream.arrayBuffer()), contentType };
}

async function trim(original: Buffer): Promise<Buffer> {
  try {
    return await sharp(original).trim({ threshold: TRIM_THRESHOLD }).toBuffer();
  } catch {
    // Unusual format, corrupt file, etc. — trimming is a nice-to-have,
    // never a reason to fail; fall back to the untrimmed original.
    return original;
  }
}

/**
 * Trim, then place the trimmed product onto a fixed `CARD_CANVAS_WIDTH` ×
 * `CARD_CANVAS_HEIGHT` canvas, centered, filled with the neutral card
 * background. `fit: "inside"` + `withoutEnlargement` guarantees the full
 * trimmed product is preserved at its own proportions — never cropped,
 * never stretched, never upscaled past its native resolution — so a
 * narrow product (e.g. ratio ≈0.53) simply occupies less of the canvas
 * width, with the remaining canvas painted in the same neutral fill
 * rather than left for CSS/the page background to fill in. Falls back to
 * a plain trim (no canvas) if compositing itself fails, so a processing
 * error degrades to "natural" rather than a broken image.
 */
async function trimAndComposite(original: Buffer): Promise<Buffer> {
  const trimmed = await trim(original);
  try {
    const resized = await sharp(trimmed)
      .resize({
        width: CARD_CANVAS_WIDTH,
        height: CARD_CANVAS_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    return await sharp({
      create: {
        width: CARD_CANVAS_WIDTH,
        height: CARD_CANVAS_HEIGHT,
        channels: 3,
        background: CARD_CANVAS_BACKGROUND,
      },
    })
      .composite([{ input: resized, gravity: "centre" }])
      .png()
      .toBuffer();
  } catch {
    return trimmed;
  }
}

async function processFor(variant: ProductImageVariant, sourceUrl: string): Promise<CachedImage> {
  const key = cacheKeyFor(variant, sourceUrl);
  const inFlightKey = `${variant}:${key}`;

  const cached = await readFromDiskCache(key);
  if (cached) return cached;

  const pending = inFlight.get(inFlightKey);
  if (pending) return pending;

  const task = (async (): Promise<CachedImage> => {
    const { buffer: original, contentType: originalContentType } = await fetchOriginal(sourceUrl);

    const image: CachedImage =
      variant === "natural"
        ? { buffer: await trim(original), contentType: originalContentType }
        : { buffer: await trimAndComposite(original), contentType: "image/png" };

    await writeToDiskCache(key, image);
    return image;
  })();

  inFlight.set(inFlightKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(inFlightKey);
  }
}

export function getNaturalProductImage(sourceUrl: string): Promise<CachedImage> {
  return processFor("natural", sourceUrl);
}

export function getCardProductImage(sourceUrl: string): Promise<CachedImage> {
  return processFor("card", sourceUrl);
}
