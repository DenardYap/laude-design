"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Phase = "loading" | "fading" | "hidden";

const FADE_MS = 280;
// Minimum on-screen time so the overlay doesn't flash for fast bundles —
// enough to register as deliberate loading feedback, not a flicker.
const MIN_VISIBLE_MS = 600;
// Hard ceiling: even if the iframe never fires `load` (network blocked,
// CDN down, etc.) we always get out of the user's way after this long.
const MAX_VISIBLE_MS = 3500;

/**
 * Sits over the Sandpack iframe area while a freshly-mounted design is
 * bundling and booting. Two-phase fade-out (`loading → fading → hidden`):
 *  1. Wait for the iframe's `load` event OR a short minimum delay,
 *     whichever finishes last.
 *  2. Fade opacity to 0, then unmount.
 *
 * Critically this component renders as a SIBLING of `SandpackProvider`, not
 * a child — so it never participates in Sandpack's internal layout, never
 * blocks the bundler's intersection observer, and never holds a reference
 * into Sandpack state. It is purely presentational.
 */
export function CanvasLoadingOverlay() {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const mountedAtRef = React.useRef<number>(Date.now());

  const startFade = React.useCallback(() => {
    const elapsed = Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    window.setTimeout(() => {
      setPhase((prev) => (prev === "loading" ? "fading" : prev));
    }, remaining);
  }, []);

  React.useEffect(() => {
    if (phase !== "fading") return;
    const t = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Listen for the Sandpack preview iframe to finish its initial document
  // load. We poll briefly for the iframe element because it's mounted by
  // Sandpack on a microtask after our own effect runs. Once we have it,
  // a single `load` listener is enough.
  React.useEffect(() => {
    let cancelled = false;
    let iframe: HTMLIFrameElement | null = null;

    function onLoad() {
      if (!cancelled) startFade();
    }

    let pollAttempts = 0;
    const pollInterval = window.setInterval(() => {
      pollAttempts += 1;
      if (cancelled) return;
      iframe = document.querySelector(
        ".sp-preview-iframe",
      ) as HTMLIFrameElement | null;
      if (iframe) {
        window.clearInterval(pollInterval);
        iframe.addEventListener("load", onLoad, { once: true });
      } else if (pollAttempts > 40) {
        window.clearInterval(pollInterval);
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
      iframe?.removeEventListener("load", onLoad);
    };
  }, [startFade]);

  // Hard safety net so the overlay never traps the user behind it.
  React.useEffect(() => {
    const t = window.setTimeout(startFade, MAX_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [startFade]);

  if (phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-canvas",
        "transition-opacity ease-out",
        phase === "fading" ? "opacity-0" : "opacity-100",
      )}
      style={{
        backgroundImage:
          "radial-gradient(hsl(var(--canvas-grid)) 0.6px, transparent 0.6px)",
        backgroundSize: "5px 5px",
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <BrushStrokeLoader />
        <p className="text-sm font-medium tracking-wide text-ink-muted">
          Loading design…
        </p>
      </div>
      <span className="sr-only">Loading design preview</span>
    </div>
  );
}

/**
 * A brush stroke that paints itself in along an organic curve, then sweeps
 * off the canvas in the same direction — a continuous, unbroken motion
 * (no opacity reset, no jarring snap-back). The leading "wet paint" tip
 * follows the curve via `offset-path` and disappears once the stroke is
 * fully laid down.
 *
 * Path coords are normalised to a 120×60 viewBox; `pathLength="100"` lets
 * the dasharray/dashoffset math live in CSS as plain percentages.
 */
function BrushStrokeLoader() {
  // SVG `offset-path` needs the curve as a CSS path() string, so it's
  // declared once and reused for both the visible stroke and the brush tip.
  const curve = "M14 42 Q40 8 60 30 T106 22";
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      aria-hidden="true"
      className="h-16 w-32 text-brand-hover"
    >
      <path
        d={curve}
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        pathLength={100}
        className="paint-loader-stroke"
      />
      <circle
        cx={0}
        cy={0}
        r={4}
        fill="hsl(var(--brand-foreground))"
        className="paint-loader-brush"
        style={{ offsetPath: `path("${curve}")` }}
      />
    </svg>
  );
}
