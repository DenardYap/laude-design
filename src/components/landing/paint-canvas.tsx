"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * A full-viewport paint surface for the landing page.
 *
 * The native cursor is hidden over the canvas and replaced with a custom
 * paintbrush SVG (see PaintBrushCursor below). Click + drag deposits a
 * textured stroke composed of many "bristle" sub-strokes; paint depletes
 * along the stroke, splays as bristles drop out, and occasionally drips.
 *
 * Interactive elements above the canvas (Sign in, Get started, Star on
 * GitHub) stay clickable because their wrappers are pointer-events-none
 * while the buttons themselves are pointer-events-auto — clicks on empty
 * space fall through to the canvas, clicks on buttons do not.
 */

type RGB = { r: number; g: number; b: number };

type Bristle = {
  // Lateral offset across the brush head, normalized to -1..1.
  offset: number;
  width: number;
  alpha: number;
};

type Point = { x: number; y: number; t: number };

type Drip = {
  x: number;
  y: number;
  vy: number;
  width: number;
  alpha: number;
  color: RGB;
  life: number;
  maxLife: number;
};

// Warm palette aligned with the brand cream + complementary accents.
const PALETTE: RGB[] = [
  { r: 218, g: 138, b: 47 }, // amber
  { r: 199, g: 70, b: 38 }, // terracotta
  { r: 96, g: 130, b: 92 }, // sage
  { r: 196, g: 100, b: 130 }, // dusty rose
  { r: 78, g: 110, b: 154 }, // slate blue
  { r: 132, g: 88, b: 142 }, // plum
];

const BRUSH_RADIUS = 13;
const BRISTLE_COUNT = 18;

// The brush tip's location inside the SVG, used to align the rendered
// brush so its tip sits exactly under the pointer.
const TIP_X = 8;
const TIP_Y = 52;

function makeBristles(): Bristle[] {
  const out: Bristle[] = [];
  for (let i = 0; i < BRISTLE_COUNT; i++) {
    const t = (i + 0.5) / BRISTLE_COUNT;
    const offset = (t - 0.5) * 2;
    // A gentle dome over the center keeps strokes denser in the middle and
    // wispier at the edges, mimicking a real splayed brush head.
    const dome = 1 - Math.abs(offset);
    out.push({
      offset: offset + (Math.random() - 0.5) * 0.06,
      width: 0.55 + Math.random() * 1.1,
      alpha: 0.16 + dome * 0.55 + Math.random() * 0.18,
    });
  }
  return out;
}

export function PaintCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // Drives a re-render of the brush-tip swatch whenever we cycle colors.
  const [colorIndex, setColorIndex] = useState(0);
  // Mount the painting surface only on devices with a real pointer. Touch
  // phones don't have a hover/cursor, the brush UX is awkward at thumb
  // scale, and `touch-none` on the canvas would block page scrolling. We
  // resolve this in an effect so SSR markup matches the first client
  // render (which always reports `false`).
  const [enabled, setEnabled] = useState(false);

  const stateRef = useRef({
    drawing: false,
    points: [] as Point[],
    bristles: makeBristles(),
    paint: 1,
    drips: [] as Drip[],
    rafId: 0,
    colorIndex: 0,
    lastPointer: { x: 0, y: 0 },
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setEnabled(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    stateRef.current.drips = [];
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const cursor = cursorRef.current;
    if (!canvas || !cursor) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = stateRef.current;

    cursor.style.transformOrigin = `${TIP_X}px ${TIP_Y}px`;

    function setSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Preserve any existing painting across resizes.
      const prev =
        canvas!.width && canvas!.height
          ? ctx!.getImageData(0, 0, canvas!.width, canvas!.height)
          : null;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (prev) {
        ctx!.save();
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.putImageData(prev, 0, 0);
        ctx!.restore();
      }
    }
    setSize();
    window.addEventListener("resize", setSize);

    function activeColor(): RGB {
      return PALETTE[state.colorIndex % PALETTE.length]!;
    }

    function drawSegment(from: Point, ctrl: Point, to: Point) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) return;

      const dt = Math.max(1, to.t - from.t);
      const speed = len / dt;

      // Faster movement uses less paint per unit length but spreads more.
      state.paint = Math.max(0, state.paint - len * 0.0006 - speed * 0.002);
      const paintLevel = state.paint;
      // Pressure simulation: faster strokes register thinner.
      const pressure = Math.max(0.45, 1 - speed * 0.28);

      const c = activeColor();
      const nx = -dy / len;
      const ny = dx / len;

      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";

      for (const b of state.bristles) {
        // As paint depletes, the lighter outer bristles drop out first,
        // leaving a sparse, dragged-dry-brush look.
        if (paintLevel < 0.32 && b.alpha < 0.42 && Math.random() > paintLevel * 2.6) {
          continue;
        }
        const ox = nx * b.offset * BRUSH_RADIUS;
        const oy = ny * b.offset * BRUSH_RADIUS;
        ctx!.lineWidth = b.width * (0.6 + paintLevel * 0.7) * pressure;
        const a = b.alpha * (0.42 + paintLevel * 0.58);
        ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
        ctx!.beginPath();
        ctx!.moveTo(from.x + ox, from.y + oy);
        ctx!.quadraticCurveTo(ctrl.x + ox, ctrl.y + oy, to.x + ox, to.y + oy);
        ctx!.stroke();
      }

      // Pooling: a slow, paint-rich brush leaves small darker dabs.
      if (paintLevel > 0.6 && speed < 0.3 && Math.random() < 0.18) {
        ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},0.55)`;
        const r = 0.8 + Math.random() * 1.6;
        ctx!.beginPath();
        ctx!.arc(
          to.x + (Math.random() - 0.5) * BRUSH_RADIUS * 0.6,
          to.y + (Math.random() - 0.5) * BRUSH_RADIUS * 0.6,
          r,
          0,
          Math.PI * 2,
        );
        ctx!.fill();
      }
    }

    function spawnDrip(p: Point, intensity: number) {
      const c = activeColor();
      state.drips.push({
        x: p.x + (Math.random() - 0.5) * BRUSH_RADIUS * 0.5,
        y: p.y,
        vy: 0.12 + Math.random() * 0.25,
        width: 1.4 + Math.random() * 2 * intensity,
        alpha: 0.4 + intensity * 0.4,
        color: c,
        life: 0,
        maxLife: 140 + Math.random() * 220,
      });
    }

    function tick() {
      const h = window.innerHeight;
      const next: Drip[] = [];
      for (const d of state.drips) {
        d.vy += 0.038; // gravity
        const py = d.y;
        d.y += d.vy;
        d.life += 1;
        d.alpha *= 0.992;
        d.width *= 0.997;
        ctx!.strokeStyle = `rgba(${d.color.r},${d.color.g},${d.color.b},${d.alpha})`;
        ctx!.lineWidth = d.width;
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(d.x, py);
        ctx!.lineTo(d.x, d.y);
        ctx!.stroke();
        if (d.life < d.maxLife && d.alpha > 0.04 && d.y < h + 30) next.push(d);
      }
      state.drips = next;
      state.rafId = requestAnimationFrame(tick);
    }
    state.rafId = requestAnimationFrame(tick);

    function isOverCanvas(target: EventTarget | null) {
      // While drawing, pointer capture keeps the canvas as the target even
      // if the geometric target is e.g. a button.
      return target === canvas || state.drawing;
    }

    function applyCursor(x: number, y: number, visible: boolean) {
      if (!cursor) return;
      cursor.style.opacity = visible ? "1" : "0";
      const scale = state.drawing ? 0.92 : 1;
      const tilt = state.drawing ? 4 : 0;
      cursor.style.transform = `translate(${x - TIP_X}px, ${y - TIP_Y}px) rotate(${tilt}deg) scale(${scale})`;
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (e.target !== canvas) return;
      state.drawing = true;
      state.bristles = makeBristles();
      state.paint = 1;
      const p: Point = { x: e.clientX, y: e.clientY, t: performance.now() };
      state.points = [p, p];
      // Initial dab so a single click leaves a visible mark.
      drawSegment(p, p, { x: p.x + 0.6, y: p.y + 0.6, t: p.t + 1 });
      try {
        canvas!.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw on some platforms (e.g. when the
        // pointer was already captured). Painting still works without it.
      }
      applyCursor(e.clientX, e.clientY, true);
    }

    function onPointerMove(e: PointerEvent) {
      state.lastPointer.x = e.clientX;
      state.lastPointer.y = e.clientY;
      const overCanvas = isOverCanvas(e.target);
      applyCursor(e.clientX, e.clientY, overCanvas);

      if (!state.drawing) return;
      const now = performance.now();
      const last = state.points[state.points.length - 1]!;
      const newP: Point = { x: e.clientX, y: e.clientY, t: now };
      // Reject sub-pixel jitter so quadratic smoothing has room to breathe.
      if (Math.hypot(newP.x - last.x, newP.y - last.y) < 0.6) return;

      const prev = state.points[state.points.length - 2] ?? last;
      const midA: Point = {
        x: (prev.x + last.x) / 2,
        y: (prev.y + last.y) / 2,
        t: last.t,
      };
      const midB: Point = {
        x: (last.x + newP.x) / 2,
        y: (last.y + newP.y) / 2,
        t: now,
      };
      // Quadratic curve: from one mid-point, through `last`, to the next
      // mid-point. This is the classic trick for smooth ink-style strokes.
      drawSegment(midA, last, midB);

      state.points.push(newP);
      if (state.points.length > 8) state.points.shift();

      const speed = Math.hypot(newP.x - last.x, newP.y - last.y);
      // Slow strokes with full paint occasionally throw off a drip.
      if (state.paint > 0.65 && speed < 1.4 && Math.random() < 0.04) {
        spawnDrip(newP, state.paint);
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!state.drawing) {
        applyCursor(e.clientX, e.clientY, e.target === canvas);
        return;
      }
      state.drawing = false;
      const last = state.points[state.points.length - 1];
      if (last && state.paint > 0.25) {
        // 1–2 farewell drips wherever paint pooled at stroke-end.
        const drips = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < drips; i++) {
          const p =
            state.points[Math.floor(Math.random() * state.points.length)] ??
            last;
          spawnDrip(p, Math.min(1, state.paint + 0.1));
        }
      }
      state.points = [];
      state.colorIndex = (state.colorIndex + 1) % PALETTE.length;
      setColorIndex(state.colorIndex);
      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {
        // Capture may already have been released.
      }
      applyCursor(e.clientX, e.clientY, e.target === canvas);
    }

    function onPointerLeaveDoc() {
      if (cursor) cursor.style.opacity = "0";
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("pointerleave", onPointerLeaveDoc);

    return () => {
      window.removeEventListener("resize", setSize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("pointerleave", onPointerLeaveDoc);
      cancelAnimationFrame(state.rafId);
    };
  }, [enabled]);

  const tip = PALETTE[colorIndex % PALETTE.length]!;
  const tipColor = `rgb(${tip.r}, ${tip.g}, ${tip.b})`;

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 cursor-none touch-none"
        aria-hidden
      />
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-150 will-change-transform"
        aria-hidden
      >
        <PaintBrushCursor color={tipColor} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={clearCanvas}
        className="pointer-events-auto fixed bottom-5 right-5 z-40 backdrop-blur"
      >
        <Eraser className="size-3.5" />
        Clear paint
      </Button>
    </>
  );
}

/**
 * The brush itself. Its tip sits at (TIP_X, TIP_Y) in this SVG's coordinate
 * space, which is what the wrapper translates to the pointer position.
 */
function PaintBrushCursor({ color }: { color: string }) {
  return (
    <svg
      width={60}
      height={60}
      viewBox="0 0 60 60"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="brush-handle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(28 42% 42%)" />
          <stop offset="50%" stopColor="hsl(26 38% 30%)" />
          <stop offset="100%" stopColor="hsl(24 35% 22%)" />
        </linearGradient>
        <linearGradient id="brush-ferrule" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(30 6% 58%)" />
          <stop offset="50%" stopColor="hsl(30 6% 82%)" />
          <stop offset="100%" stopColor="hsl(30 6% 60%)" />
        </linearGradient>
      </defs>

      <ellipse cx="14" cy="56" rx="9" ry="1.6" fill="rgba(0,0,0,0.18)" />

      <path
        d={`M ${8} ${52} L 16 38 L 26 44 L 18 56 Z`}
        fill={color}
        stroke="rgba(0,0,0,0.28)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <g
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      >
        <line x1="8" y1="52" x2="5" y2="55" />
        <line x1="10" y1="50" x2="6" y2="51" />
        <line x1="12" y1="48" x2="7" y2="48" />
        <line x1="15" y1="55" x2="11" y2="56" />
      </g>

      <path
        d="M 18 38 L 28 28 L 36 36 L 26 46 Z"
        fill="url(#brush-ferrule)"
        stroke="hsl(30 8% 38%)"
        strokeWidth="0.6"
      />
      <line
        x1="22"
        y1="34"
        x2="32"
        y2="42"
        stroke="hsl(30 8% 30%)"
        strokeWidth="0.6"
        opacity="0.5"
      />

      <path
        d="M 28 28 L 50 6 L 56 12 L 34 34 Z"
        fill="url(#brush-handle)"
        stroke="hsl(24 40% 14%)"
        strokeWidth="0.6"
      />
      <line
        x1="32"
        y1="26"
        x2="52"
        y2="6"
        stroke="hsl(28 28% 60%)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}
