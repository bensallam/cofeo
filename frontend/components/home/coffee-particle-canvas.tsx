"use client";

import * as React from "react";

type CoffeeParticleCanvasProps = {
  /** Mirrors the diagonal bean/dust stream for RTL locales, so it reads
   * with the same visual momentum as the (mirrored) text column next to
   * it, instead of clashing with the flipped layout. */
  rtl?: boolean;
  className?: string;
};

type Particle = {
  /** Position along the diagonal stream, 0..1, and perpendicular offset
   * in px at depth=1 (scaled by the taper function at draw time). */
  t: number;
  offset: number;
  depth: number; // 0 = far, 1 = near — drives size, opacity, parallax
  size: number;
  isBean: boolean;
  rotation: number;
  rotationSpeed: number;
  phase: number; // per-particle seed for turbulence, avoids synchronized motion
  freq: number;
};

const DUST_COUNT_DESKTOP = 680;
const DUST_COUNT_MOBILE = 220;
const BEAN_COUNT_DESKTOP = 20;
const BEAN_COUNT_MOBILE = 9;

const GOLD = { r: 224, g: 170, b: 96 };

function taper(t: number) {
  // Widest mid-stream, tapering to a point at both ends — the elongated
  // "spindle" cloud shape from the reference, not a uniform band.
  return Math.pow(Math.sin(Math.min(Math.max(t, 0), 1) * Math.PI), 0.6);
}

function makeGlowSprite() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, 0.9)`);
  grad.addColorStop(0.4, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, 0.35)`);
  grad.addColorStop(1, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function drawBean(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
) {
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

export function CoffeeParticleCanvas({ rtl = false, className }: CoffeeParticleCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    // Re-bound to a fresh const so its non-null type is retained inside
    // the closures declared below (TS doesn't otherwise carry a `let`-
    // style narrowing of `ctx` itself into nested function bodies).
    const ctx = maybeCtx;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glowSprite = makeGlowSprite();

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];

    function seedParticles() {
      const isSmall = width < 640;
      const dustCount = isSmall ? DUST_COUNT_MOBILE : DUST_COUNT_DESKTOP;
      const beanCount = isSmall ? BEAN_COUNT_MOBILE : BEAN_COUNT_DESKTOP;
      const list: Particle[] = [];

      for (let i = 0; i < dustCount; i++) {
        // Skewed toward 0: most grains are fine and distant, only a
        // handful are large/near — a fine mist, not a field of bubbles.
        const depth = Math.random() * Math.random();
        list.push({
          t: Math.random(),
          offset: (Math.random() * 2 - 1),
          depth,
          size: 0.5 + depth * 2.1,
          isBean: false,
          rotation: 0,
          rotationSpeed: 0,
          phase: Math.random() * Math.PI * 2,
          freq: 0.15 + Math.random() * 0.25,
        });
      }
      for (let i = 0; i < beanCount; i++) {
        const depth = 0.35 + Math.random() * 0.65;
        list.push({
          t: 0.15 + Math.random() * 0.7,
          offset: (Math.random() * 2 - 1) * 0.7,
          depth,
          size: 10 + depth * 22,
          isBean: true,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.12,
          phase: Math.random() * Math.PI * 2,
          freq: 0.08 + Math.random() * 0.1,
        });
      }
      particles = list;
    }

    function resize() {
      if (!canvas || !container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    }

    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    // Diagonal stream axis: bottom-start → top-end. Mirrored for RTL so
    // it keeps the same visual momentum as the mirrored text column.
    function axisPoints() {
      const dir = rtl ? -1 : 1;
      const ax = width * (rtl ? 0.85 : 0.12);
      const ay = height * 0.86;
      const bx = width * (rtl ? 0.15 : 0.88);
      const by = height * 0.08;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      // Perpendicular unit vector for the offset/taper axis.
      const nx = (-dy / len) * dir;
      const ny = (dx / len) * dir;
      return { ax, ay, dx, dy, nx, ny };
    }

    let pointerTarget = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    let scrollTarget = 0;
    let scrollOffset = 0;
    let visible = true;

    function onPointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      pointerTarget = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      };
    }
    function onPointerLeave() {
      pointerTarget = { x: 0, y: 0 };
    }
    function onScroll() {
      const rect = container!.getBoundingClientRect();
      const progress = 1 - Math.min(Math.max(rect.top / window.innerHeight, -1), 1);
      scrollTarget = progress;
    }

    if (!reduceMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      container.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(container);

    let raf = 0;
    const start = performance.now();

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible) return;

      const t = (now - start) / 1000;
      pointer.x += (pointerTarget.x - pointer.x) * 0.06;
      pointer.y += (pointerTarget.y - pointer.y) * 0.06;
      scrollOffset += (scrollTarget - scrollOffset) * 0.06;

      ctx.clearRect(0, 0, width, height);

      const { ax, ay, dx, dy, nx, ny } = axisPoints();
      const scrollPx = Math.min(Math.max(scrollOffset, 0), 1) * -36;

      // Soft ambient haze along the stream — unifies the field into a
      // glowing cloud rather than a scatter of isolated points.
      for (const ft of [0.18, 0.3, 0.42, 0.54, 0.66, 0.78]) {
        const hx = ax + dx * ft + pointer.x * 10;
        const hy = ay + dy * ft + pointer.y * 6 + scrollPx * 0.5;
        const hsize = (130 + 40 * Math.sin(t * 0.1 + ft * 6)) * taper(ft);
        ctx.globalAlpha = 0.06;
        ctx.drawImage(glowSprite, hx - hsize / 2, hy - hsize / 2, hsize, hsize);
        ctx.globalAlpha = 1;
      }

      // Dust first (background), beans on top (foreground detail).
      for (const p of particles) {
        if (p.isBean) continue;
        drawDust(p);
      }
      for (const p of particles) {
        if (!p.isBean) continue;
        drawBeanParticle(p);
      }

      function baseXY(p: Particle) {
        const bandWidth = 26 + p.depth * 22;
        const wobble =
          Math.sin(t * p.freq + p.phase) * 10 * (0.4 + p.depth) +
          Math.sin(t * p.freq * 2.3 + p.phase * 1.7) * 4;
        const perp = p.offset * bandWidth * taper(p.t) + wobble;
        const x = ax + dx * p.t + nx * perp;
        const y = ay + dy * p.t + ny * perp;
        const parallax = 4 + p.depth * 18;
        return {
          x: x + pointer.x * parallax,
          y: y + pointer.y * parallax * 0.6 + scrollPx * (0.3 + p.depth * 0.7),
        };
      }

      function drawDust(p: Particle) {
        const { x, y } = baseXY(p);
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
        const twinkle = 0.55 + 0.45 * Math.sin(t * p.freq * 1.6 + p.phase * 2.1);
        const opacity = (0.22 + p.depth * 0.65) * twinkle;
        const drawSize = p.size * 6.5;
        ctx.globalAlpha = Math.min(opacity, 1);
        ctx.drawImage(glowSprite, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
        ctx.globalAlpha = 1;
      }

      function drawBeanParticle(p: Particle) {
        const { x, y } = baseXY(p);
        p.rotation += p.rotationSpeed * 0.016;
        const opacity = 0.85 + p.depth * 0.15;

        // Soft halo behind the bean so it reads as the glowing source of
        // the dust trail, rather than getting lost in the surrounding mist.
        const haloSize = p.size * 3.2;
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glowSprite, x - haloSize / 2, y - haloSize / 2, haloSize, haloSize);
        ctx.globalAlpha = 1;

        drawBean(ctx, x, y, p.size, p.rotation, Math.min(opacity, 1));
      }
    }

    if (reduceMotion) {
      ctx.clearRect(0, 0, width, height);
      const { ax, ay, dx, dy, nx, ny } = axisPoints();
      for (const p of particles) {
        const bandWidth = 26 + p.depth * 22;
        const perp = p.offset * bandWidth * taper(p.t);
        const x = ax + dx * p.t + nx * perp;
        const y = ay + dy * p.t + ny * perp;
        if (p.isBean) {
          const haloSize = p.size * 3.2;
          ctx.globalAlpha = 0.35;
          ctx.drawImage(glowSprite, x - haloSize / 2, y - haloSize / 2, haloSize, haloSize);
          ctx.globalAlpha = 1;
          drawBean(ctx, x, y, p.size, p.rotation, 0.9);
        } else {
          const drawSize = p.size * 6.5;
          ctx.globalAlpha = Math.min(0.22 + p.depth * 0.65, 1);
          ctx.drawImage(glowSprite, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
          ctx.globalAlpha = 1;
        }
      }
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [rtl]);

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
