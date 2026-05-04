"use client";

import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ScreenshotRect } from "@/components/workspace/canvas/use-screenshot";

interface ScreenshotAreaOverlayProps {
  /** Element being captured. The overlay renders on top of its bounding box. */
  captureRef: RefObject<HTMLDivElement | null>;
  /** Called with the user's selection in parent-page viewport CSS coords. */
  onCapture: (rect: ScreenshotRect) => void;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Snipping-tool style selection overlay. Mounted at the workspace level so
 * it covers the live canvas (no separate modal, no clone-of-the-canvas
 * trick). When the toolbar enters `screenshot-area` mode we:
 *   1. Pin a fixed-position layer over the captureRef element.
 *   2. Show crosshair cursor + dim-mask UX so it's obvious what's about to
 *      be captured.
 *   3. On mouseup, translate the viewport selection to captureRef-local
 *      coords and hand it off to `onCapture` for cropping/upload.
 *
 * Escape (or a zero-area click) cancels and pops back to "idle".
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
  // pane-drag. We poll on rAF while active because there's no single event
  // that catches every layout change (resize observers don't fire on parent
  // scrolls, scroll listeners miss programmatic resizes from the resizable
  // panel group, etc).
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

  // When idle (no drag yet) we fully dim the captureRef so it's obvious the
  // tool is armed. While dragging, the dim splits into 4 strips around the
  // selection so the user can see exactly what they're capturing.
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

function DimWithCutout({
  sel,
  bounds,
}: {
  sel: { left: number; top: number; width: number; height: number };
  bounds: DOMRect;
}) {
  // Local coords (origin = overlay's top-left).
  const x = sel.left - bounds.left;
  const y = sel.top - bounds.top;
  const w = sel.width;
  const h = sel.height;
  return (
    <>
      <div
        className="absolute bg-ink/25"
        style={{ left: 0, top: 0, right: 0, height: Math.max(0, y) }}
      />
      <div
        className="absolute bg-ink/25"
        style={{ left: 0, top: y + h, right: 0, bottom: 0 }}
      />
      <div
        className="absolute bg-ink/25"
        style={{ left: 0, top: y, width: Math.max(0, x), height: h }}
      />
      <div
        className="absolute bg-ink/25"
        style={{ left: x + w, top: y, right: 0, height: h }}
      />
    </>
  );
}

function HintLabel() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-background shadow-lg">
      Drag to capture an area · Esc to cancel
    </div>
  );
}
