"use client";

import * as React from "react";

type Captions = { bean: string; grind: string; extract: string; aroma: string; universe: string };

type CoffeeJourneyStageProps = {
  eyebrow: string;
  headlineLine1: string;
  headlineLine2: string;
  captions: Captions;
  scrollLabel: string;
};

/**
 * The scroll-scrubbed narrative: BEAN → GRINDING → EXTRACTION → AROMA →
 * the particles settling into the COFEO mark. One `progress` float
 * (0..1, derived from how far the page has scrolled through the tall
 * track this stage sits inside — see coffee-journey-hero.tsx) drives
 * every particle's target position each frame; particles *chase* that
 * target with a lerp rather than snapping to it, which is what makes
 * phase changes read as one continuous motion instead of five separate
 * animations stitched together.
 *
 * Text overlays (headline/caption/scroll-hint/the crisp logo reveal) are
 * plain refs mutated directly in the same rAF loop — not React state —
 * so a scroll tick never triggers a re-render; only canvas pixels and a
 * handful of `style.opacity`/`style.transform` writes change per frame.
 */
const PHASE = {
  introEnd: 0.14,
  convergeEnd: 0.3,
  grindEnd: 0.46,
  extractEnd: 0.64,
  aromaEnd: 0.86,
} as const;

const COPPER = { r: 181, g: 113, b: 74 };
const DUST_COUNT_DESKTOP = 520;
const DUST_COUNT_MOBILE = 190;
const BEAN_COUNT_DESKTOP = 22;
const BEAN_COUNT_MOBILE = 11;
const LOGO_SAMPLE_STRIDE = 3;
const LOGO_ALPHA_THRESHOLD = 120;

type Particle = {
  homeXFrac: number;
  homeYFrac: number;
  x: number;
  y: number;
  opacity: number;
  size: number;
  isBean: boolean;
  rotation: number;
  rotationSpeed: number;
  seed: number; // 0..1, per-particle randomness (wobble phase, stagger delay)
  freq: number;
  burstAngle: number;
  offsetSeed: number; // -1..1, lateral seed for the extraction/aroma streams
  logoX: number;
  logoY: number;
  hasLogoTarget: boolean;
};

function ease(t: number) {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c); // smoothstep
}
function easeOut(t: number) {
  const c = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - c) * (1 - c);
}
function windowOpacity(p: number, start: number, end: number, fade: number) {
  if (p <= start - fade || p >= end + fade) return 0;
  if (p < start) return ease((p - (start - fade)) / fade);
  if (p > end) return 1 - ease((p - end) / fade);
  return 1;
}

function makeGlowSprite() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${COPPER.r}, ${COPPER.g}, ${COPPER.b}, 0.9)`);
  grad.addColorStop(0.4, `rgba(${COPPER.r}, ${COPPER.g}, ${COPPER.b}, 0.32)`);
  grad.addColorStop(1, `rgba(${COPPER.r}, ${COPPER.g}, ${COPPER.b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function drawBean(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, opacity: number) {
  if (opacity <= 0.01 || size <= 0.4) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = opacity;
  const grad = ctx.createLinearGradient(-size / 2, -size / 3, size / 2, size / 3);
  grad.addColorStop(0, "#6b4326");
  grad.addColorStop(0.5, "#2c1c11");
  grad.addColorStop(1, "#0d0806");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size / 2, size / 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, (-size / 3) * 0.85);
  ctx.quadraticCurveTo(size * 0.1, 0, 0, (size / 3) * 0.85);
  ctx.stroke();
  ctx.fillStyle = "rgba(240, 196, 132, 0.32)";
  ctx.beginPath();
  ctx.ellipse(-size * 0.13, -size * 0.1, size * 0.17, size * 0.09, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Loads the (white-on-transparent) COFEO "C" mark and samples its
 * opaque pixels into a set of local-space points, centered on (0,0) —
 * the same mark already visible inside the header's logo chip, so the
 * particles spend the whole journey building toward a shape the visitor
 * has been looking at the entire time. */
function sampleLogoPoints(targetHeight: number): Promise<{ x: number; y: number }[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const targetWidth = Math.round(targetHeight * (img.width / img.height));
      const off = document.createElement("canvas");
      off.width = targetWidth;
      off.height = targetHeight;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return resolve([]);
      octx.drawImage(img, 0, 0, targetWidth, targetHeight);
      let data: Uint8ClampedArray;
      try {
        data = octx.getImageData(0, 0, targetWidth, targetHeight).data;
      } catch {
        resolve([]);
        return;
      }
      const pts: { x: number; y: number }[] = [];
      for (let y = 0; y < targetHeight; y += LOGO_SAMPLE_STRIDE) {
        for (let x = 0; x < targetWidth; x += LOGO_SAMPLE_STRIDE) {
          const alpha = data[(y * targetWidth + x) * 4 + 3];
          if (alpha > LOGO_ALPHA_THRESHOLD) {
            pts.push({ x: x - targetWidth / 2, y: y - targetHeight / 2 });
          }
        }
      }
      for (let i = pts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pts[i], pts[j]] = [pts[j], pts[i]];
      }
      resolve(pts);
    };
    img.onerror = () => resolve([]);
    img.src = "/cofeo-icon.png";
  });
}

export function CoffeeJourneyStage({ eyebrow, headlineLine1, headlineLine2, captions, scrollLabel }: CoffeeJourneyStageProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const headlineRef = React.useRef<HTMLDivElement>(null);
  const captionRef = React.useRef<HTMLSpanElement>(null);
  const scrollHintRef = React.useRef<HTMLDivElement>(null);
  const logoRevealRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!track || !canvas || !stage) return;

    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    // Re-bound to a fresh const so its non-null type is retained inside
    // the closures declared below.
    const ctx = maybeCtx;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glowSprite = makeGlowSprite();

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let logoPoints: { x: number; y: number }[] = [];
    let logoAssignedCount = 0;

    function seedParticles() {
      const isSmall = width < 640;
      const dustCount = isSmall ? DUST_COUNT_MOBILE : DUST_COUNT_DESKTOP;
      const beanCount = isSmall ? BEAN_COUNT_MOBILE : BEAN_COUNT_DESKTOP;
      const list: Particle[] = [];
      for (let i = 0; i < dustCount; i++) {
        const depth = Math.random() * Math.random();
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 0.42;
        list.push({
          homeXFrac: Math.cos(angle) * radius,
          homeYFrac: Math.sin(angle) * radius * 0.7,
          x: 0,
          y: 0,
          opacity: 0,
          size: 0.6 + depth * 2.2,
          isBean: false,
          rotation: 0,
          rotationSpeed: 0,
          seed: Math.random(),
          freq: 0.15 + Math.random() * 0.3,
          burstAngle: Math.random() * Math.PI * 2,
          offsetSeed: Math.random() * 2 - 1,
          logoX: 0,
          logoY: 0,
          hasLogoTarget: false,
        });
      }
      for (let i = 0; i < beanCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.12 + Math.random() * 0.34;
        const depth = 0.4 + Math.random() * 0.6;
        list.push({
          homeXFrac: Math.cos(angle) * radius,
          homeYFrac: Math.sin(angle) * radius * 0.68,
          x: 0,
          y: 0,
          opacity: 0,
          size: 12 + depth * 24,
          isBean: true,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.1,
          seed: Math.random(),
          freq: 0.06 + Math.random() * 0.08,
          burstAngle: Math.random() * Math.PI * 2,
          offsetSeed: Math.random() * 2 - 1,
          logoX: 0,
          logoY: 0,
          hasLogoTarget: false,
        });
      }
      particles = list;
      logoAssignedCount = 0;
    }

    function resize() {
      width = stage!.clientWidth;
      height = stage!.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    }

    resize();
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(stage);

    const logoTargetHeight = width < 640 ? 130 : 210;
    sampleLogoPoints(logoTargetHeight).then((pts) => {
      logoPoints = pts;
    });

    let pointerTarget = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    function onPointerMove(event: PointerEvent) {
      const rect = stage!.getBoundingClientRect();
      pointerTarget = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
    }
    function onPointerLeave() {
      pointerTarget = { x: 0, y: 0 };
    }

    let progressTarget = 0;
    function onScroll() {
      const rect = track!.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : 0;
      progressTarget = Math.min(Math.max(raw, 0), 1);
    }
    onScroll();

    if (!reduceMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      stage.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }

    let progress = 0;
    let lastZone = -1;
    const zoneCaptions = [captions.bean, captions.grind, captions.extract, captions.aroma, captions.universe];

    function zoneForProgress(p: number) {
      if (p < PHASE.convergeEnd) return 0;
      if (p < PHASE.grindEnd) return 1;
      if (p < PHASE.extractEnd) return 2;
      if (p < PHASE.aromaEnd) return 3;
      return 4;
    }

    function applyOverlayStyles(p: number) {
      const zone = zoneForProgress(p);
      if (zone !== lastZone) {
        lastZone = zone;
        if (captionRef.current) captionRef.current.textContent = zoneCaptions[zone] ?? "";
      }
      if (headlineRef.current) {
        const op = windowOpacity(p, 0, PHASE.introEnd * 0.55, 0.05);
        headlineRef.current.style.opacity = String(op);
        headlineRef.current.style.transform = `translateY(${(1 - op) * -14}px)`;
      }
      if (captionRef.current) {
        const op = p < 0.02 ? ease(p / 0.02) : 1;
        captionRef.current.style.opacity = String(op * (p > 0.985 ? 1 - (p - 0.985) / 0.015 : 1));
      }
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = String(windowOpacity(p, 0, 0.045, 0.03));
      }
      if (logoRevealRef.current) {
        const op = windowOpacity(p, PHASE.aromaEnd + 0.05, 1, 0.09);
        logoRevealRef.current.style.opacity = String(op);
        logoRevealRef.current.style.transform = `translate(-50%, -50%) scale(${0.93 + op * 0.07})`;
      }
    }

    function computeTarget(part: Particle, p: number) {
      const cx = width / 2 + pointer.x * 10;
      const cy = height * 0.5 + pointer.y * 6;
      const homeX = width / 2 + part.homeXFrac * width;
      const homeY = height / 2 + part.homeYFrac * height;

      if (p < PHASE.introEnd) {
        return { x: homeX, y: homeY, opacity: part.isBean ? 0.92 : 0.16 };
      }
      if (p < PHASE.convergeEnd) {
        const local = ease((p - PHASE.introEnd) / (PHASE.convergeEnd - PHASE.introEnd));
        return {
          x: homeX + (cx - homeX) * local,
          y: homeY + (cy - homeY) * local,
          opacity: part.isBean ? 0.92 : 0.16 + local * 0.14,
        };
      }
      if (p < PHASE.grindEnd) {
        const local = (p - PHASE.convergeEnd) / (PHASE.grindEnd - PHASE.convergeEnd);
        const burstT = local < 0.5 ? easeOut(local / 0.5) : 1 - ease((local - 0.5) / 0.5);
        const radius = burstT * (part.isBean ? 26 : 100) * (0.55 + part.seed * 0.9);
        return {
          x: cx + Math.cos(part.burstAngle) * radius,
          y: cy + Math.sin(part.burstAngle) * radius,
          opacity: part.isBean ? Math.max(0, 0.92 * (1 - local * 1.3)) : Math.min(1, 0.3 + local * 0.9),
        };
      }
      if (p < PHASE.extractEnd) {
        const local = ease((p - PHASE.grindEnd) / (PHASE.extractEnd - PHASE.grindEnd));
        const funnelWidth = 130 * (1 - local) + 6;
        const dropY = cy - 20 + (height * 0.34 + 20) * local;
        return {
          x: cx + part.offsetSeed * funnelWidth,
          y: dropY,
          opacity: part.isBean ? 0 : 0.85,
        };
      }
      if (p < PHASE.aromaEnd) {
        const local = (p - PHASE.extractEnd) / (PHASE.aromaEnd - PHASE.extractEnd);
        const rise = height * 0.34 - height * 0.62 * ease(local);
        const spread = 20 + local * 170;
        const wave = Math.sin(local * Math.PI * 2 * (0.5 + part.freq) + part.seed * 6.28) * spread * 0.55;
        return {
          x: cx + part.offsetSeed * spread + wave * 0.4,
          y: cy + rise,
          opacity: part.isBean ? 0 : Math.max(0.15, 0.85 - local * 0.35),
        };
      }

      // Logo formation — each dust particle claims one sampled pixel
      // from the mark (cycling if there are more particles than
      // sample points) the first time we reach this zone; a per-
      // particle stagger (seeded by `seed`) means they don't all snap
      // into place at once, reading as an assembling swarm rather than
      // a single synchronized jump-cut.
      if (!part.isBean && logoPoints.length > 0 && !part.hasLogoTarget) {
        const pt = logoPoints[logoAssignedCount % logoPoints.length];
        part.logoX = pt.x;
        part.logoY = pt.y;
        part.hasLogoTarget = true;
        logoAssignedCount++;
      }
      const local = ease((p - PHASE.aromaEnd) / (1 - PHASE.aromaEnd));
      if (!part.hasLogoTarget) {
        return { x: cx + part.offsetSeed * 220, y: cy - height * 0.28, opacity: Math.max(0, 0.4 - local * 0.4) };
      }
      const staggered = Math.min(Math.max((local - part.seed * 0.4) / (1 - part.seed * 0.4), 0), 1);
      const eased = easeOut(staggered);
      const preX = cx + part.offsetSeed * 210;
      const preY = cy - height * 0.28 + part.seed * 60;
      return {
        x: preX + (cx + part.logoX - preX) * eased,
        y: preY + (cy + part.logoY - preY) * eased,
        opacity: 0.35 + eased * 0.65,
      };
    }

    function drawFrame(t: number, p: number) {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2 + pointer.x * 10;
      const cy = height * 0.5 + pointer.y * 6;
      if (p >= PHASE.convergeEnd && p < PHASE.grindEnd) {
        const local = (p - PHASE.convergeEnd) / (PHASE.grindEnd - PHASE.convergeEnd);
        const haloSize = 90 + Math.sin(local * Math.PI) * 60;
        ctx.globalAlpha = 0.18 * Math.sin(local * Math.PI);
        ctx.drawImage(glowSprite, cx - haloSize / 2, cy - haloSize / 2, haloSize, haloSize);
        ctx.globalAlpha = 1;
      }

      for (const part of particles) {
        const target = computeTarget(part, p);
        const chase = part.isBean ? 0.1 : 0.09;
        part.x += (target.x - part.x) * chase;
        part.y += (target.y - part.y) * chase;
        part.opacity += (target.opacity - part.opacity) * 0.12;
        if (part.opacity <= 0.008) continue;

        if (part.isBean) {
          part.rotation += part.rotationSpeed * 0.016;
          const haloSize = part.size * 3;
          ctx.globalAlpha = 0.3 * part.opacity;
          ctx.drawImage(glowSprite, part.x - haloSize / 2, part.y - haloSize / 2, haloSize, haloSize);
          ctx.globalAlpha = 1;
          drawBean(ctx, part.x, part.y, part.size, part.rotation, Math.min(part.opacity, 1));
        } else {
          const drawSize = part.size * 6;
          ctx.globalAlpha = Math.min(part.opacity, 1);
          ctx.drawImage(glowSprite, part.x - drawSize / 2, part.y - drawSize / 2, drawSize, drawSize);
          ctx.globalAlpha = 1;
        }
      }
    }

    let raf = 0;
    const start = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      progress += (progressTarget - progress) * 0.09;
      pointer.x += (pointerTarget.x - pointer.x) * 0.06;
      pointer.y += (pointerTarget.y - pointer.y) * 0.06;
      drawFrame(t, progress);
      applyOverlayStyles(progress);
    }

    if (reduceMotion) {
      // One settled, static composition: no track-scrubbing, no rAF —
      // beans at rest, mark already formed. `motion-reduce:` Tailwind
      // variants on the track/stage below already collapse the tall
      // scroll runway to a single viewport height for these users; this
      // just renders the frame that matches that shorter layout.
      sampleLogoPoints(logoTargetHeight).then((pts) => {
        logoPoints = pts;
        drawFrame(0, 1);
        applyOverlayStyles(1);
      });
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [captions]);

  return (
    <div ref={trackRef} className="relative h-[400vh] motion-reduce:h-[100svh]">
      <div
        ref={stageRef}
        className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden"
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />

        <div
          ref={scrollHintRef}
          className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 opacity-0"
        >
          <span className="flex size-9 items-center justify-center rounded-full border border-(--cream)/25 text-xs text-(--cream)/70">
            ↓
          </span>
          <span className="text-[11px] font-medium tracking-[0.25em] text-(--cream)/50 uppercase">{scrollLabel}</span>
        </div>

        <div
          ref={headlineRef}
          className="pointer-events-none absolute inset-x-0 top-[38%] flex -translate-y-1/2 flex-col items-center gap-4 px-6 text-center opacity-0"
        >
          <span className="flex items-center gap-2 text-[11px] font-medium tracking-[0.3em] text-(--copper) uppercase">
            {eyebrow}
          </span>
          <h1 className="text-5xl leading-[0.95] font-medium tracking-wide text-(--cream) uppercase sm:text-6xl lg:text-7xl">
            <span className="block">{headlineLine1}</span>
            <span className="block text-(--copper)">{headlineLine2}</span>
          </h1>
        </div>

        <span
          ref={captionRef}
          className="pointer-events-none absolute inset-x-0 bottom-14 text-center text-[11px] font-medium tracking-[0.35em] text-(--cream)/55 uppercase opacity-0"
        />

        <div
          ref={logoRevealRef}
          className="pointer-events-none absolute top-1/2 left-1/2 opacity-0"
          style={{ transform: "translate(-50%, -50%) scale(0.93)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cofeo-logo.png"
            alt="COFEO"
            width={780}
            height={243}
            className="h-10 w-auto sm:h-14"
            style={{ filter: "drop-shadow(0 0 24px rgba(181,113,74,0.35))" }}
          />
        </div>
      </div>
    </div>
  );
}
