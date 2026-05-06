"use client";

import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ScreenshotRect } from "@/components/workspace/canvas/hooks/use-screenshot";
import { DimWithCutout } from "@/components/workspace/canvas/dim-with-cutout";
import { HintLabel } from "@/components/workspace/canvas/hint-label";
import type { ScreenshotAreaOverlayProps, Point } from "@/components/workspace/canvas/types/screenshot";

/**
 * Snipping-tool style selection overlay.
 */
export function ScreenshotAreaOverlay({
  captureRef,
  onCapture,
}: ScreenshotAreaOverlayProps) {
  const tool = useWorkspaceStore((s) => s.tool);
  const setTool = useWorkspaceStore((s) => s.setTool);
  const active = tool === "screenshot-area";

  const [bounds, setBounds] = useState<DOMRect | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);

  // Track captureRef bounds so the overlay re-aligns on resize / scroll /
  // pane-drag.
  useEffect(() => {
    if (!active) {
      setBounds(null);
      setStart(null);
      setEnd(null);
      return;
    }

    let raf = 0;
    let lastSerialized = "";
    const tick = () => {
      const r = captureRef.current?.getBoundingClientRect();
      if (r) {
        const serialized = `${r.left},${r.top},${r.width},${r.height}`;
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          setBounds(r);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, captureRef]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setTool("idle");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, setTool]);

  // Track move/up at the window level once the drag begins so the user can
  // pull the selection past the canvas edge without losing the gesture (a
  // common slip when the area of interest sits flush with the right/bottom
  // border).
  useEffect(() => {
    if (!start) return;

    const onMove = (e: globalThis.MouseEvent) => {
      setEnd({ x: e.clientX, y: e.clientY });
    };
    const onUp = (e: globalThis.MouseEvent) => {
      const finalEnd = { x: e.clientX, y: e.clientY };
      const x1 = Math.min(start.x, finalEnd.x);
      const y1 = Math.min(start.y, finalEnd.y);
      const x2 = Math.max(start.x, finalEnd.x);
      const y2 = Math.max(start.y, finalEnd.y);
      const w = x2 - x1;
      const h = y2 - y1;

      setStart(null);
      setEnd(null);

      // Treat a click (or near-click) as cancel rather than capturing a 1×1
      // px image. Anything below ~10px on either axis is almost certainly a
      // slip rather than an intentional micro-selection.
      if (w < 10 || h < 10) {
        setTool("idle");
        return;
      }
      onCapture({ x: x1, y: y1, width: w, height: h });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [start, onCapture, setTool]);

  if (!active || !bounds) return null;

  const handleDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const point = { x: e.clientX, y: e.clientY };
    setStart(point);
    setEnd(point);
  };

  // Selection rect in viewport coords (used to position the dim mask + outline).
  const sel =
    start && end
      ? {
          left: Math.min(start.x, end.x),
          top: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
        }
      : null;

  // When idle (no drag yet) we fully dim the captureRef 
  return (
    <div
      style={{
        position: "fixed",
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        zIndex: 50,
        cursor: "crosshair",
        userSelect: "none",
      }}
      onMouseDown={handleDown}
    >
      {sel ? (
        <DimWithCutout sel={sel} bounds={bounds} />
      ) : (
        <div className="absolute inset-0 bg-ink/25" />
      )}

      {sel ? (
        <>
          <div
            className="pointer-events-none absolute border-2 border-brand shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
            style={{
              left: sel.left - bounds.left,
              top: sel.top - bounds.top,
              width: sel.width,
              height: sel.height,
            }}
          />
          <div
            className="pointer-events-none absolute rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-background shadow-md"
            style={{
              left: sel.left - bounds.left,
              top:
                sel.top - bounds.top + sel.height + 6 < bounds.height - 24
                  ? sel.top - bounds.top + sel.height + 6
                  : sel.top - bounds.top - 22,
            }}
          >
            {Math.round(sel.width)} × {Math.round(sel.height)}
          </div>
        </>
      ) : (
        <HintLabel />
      )}
    </div>
  );
}

