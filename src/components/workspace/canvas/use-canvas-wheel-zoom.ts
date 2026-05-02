"use client";

import * as React from "react";

import { useWorkspaceStore } from "@/stores/workspace-store";

/**
 * Wire ⌘/ctrl + wheel to step through the canvas zoom levels — same gesture
 * that triggers browser zoom and trackpad pinch-zoom on macOS. We only act
 * when the modifier is held so plain two-finger scrolling still pans the
 * design normally.
 *
 * Throttled with a small cooldown because high-resolution wheel devices fire
 * dozens of events per pinch and we'd otherwise jump straight from 100% to
 * 500% on a single gesture.
 */
export function useCanvasWheelZoom(
  viewportRef: React.RefObject<HTMLDivElement | null>,
) {
  const zoomIn = useWorkspaceStore((s) => s.zoomIn);
  const zoomOut = useWorkspaceStore((s) => s.zoomOut);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let lastStepAt = 0;
    const STEP_COOLDOWN_MS = 60;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const now = performance.now();
      if (now - lastStepAt < STEP_COOLDOWN_MS) return;
      lastStepAt = now;

      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };

    // passive:false because we call preventDefault() to suppress the browser's
    // own page zoom on ⌘+wheel.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef, zoomIn, zoomOut]);
}
