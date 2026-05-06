"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from "@/lib/utils";
import { BrushStrokeLoader } from "@/components/workspace/canvas/brush-stroke-loader";
import type { Phase, CanvasLoadingOverlayProps } from "@/components/workspace/canvas/types/canvas-loading-overlay";

const FADE_MS = 280;
const MIN_VISIBLE_MS = 600;
const MAX_VISIBLE_MS = 12_000;

/**
 * Sits over the Sandpack iframe area while a freshly-mounted or recently-
 * updated design is bundling and booting. Two-phase fade-out
 * (`loading → fading → hidden`):
 *  1. Wait until `ready` becomes true (signalled by DesignerInternals via
 *     sandpack.status) OR until MAX_VISIBLE_MS elapses as a safety net.
 *  2. Respect a MIN_VISIBLE_MS floor so the overlay never flickers.
 *  3. Fade opacity to 0, then unmount.
 *
 * Critically this component renders as a SIBLING of `SandpackProvider`, not
 * a child — so it never participates in Sandpack's internal layout, never
 * blocks the bundler's intersection observer, and never holds a reference
 * into Sandpack state. It is purely presentational.
 */
export function CanvasLoadingOverlay({ ready = false }: CanvasLoadingOverlayProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const mountedAtRef = useRef<number>(Date.now());

  const startFade = useCallback(() => {
    const elapsed = Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    window.setTimeout(() => {
      setPhase((prev) => (prev === "loading" ? "fading" : prev));
    }, remaining);
  }, []);

  useEffect(() => {
    if (ready) startFade();
  }, [ready, startFade]);

  useEffect(() => {
    if (phase !== "fading") return;
    const t = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Hard safety net so the overlay never traps the user behind it.
  useEffect(() => {
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

