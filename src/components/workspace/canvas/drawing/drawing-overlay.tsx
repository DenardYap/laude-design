"use client";

import * as React from "react";
import { match, P } from "ts-pattern";

import {
  selectShapes,
  selectStyle,
  selectTool,
  useDrawingStore,
  type DrawTool,
  type Shape,
} from "@/stores/drawing-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { drawShape, newSeed } from "./shapes/render";
import { hitShape } from "./shapes/hit-test";

interface DrawingOverlayProps {
  projectId: string;
  /** Container the SVG fills. The overlay sizes itself to its parent. */
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

/**
 * SVG layer that renders all committed shapes plus the in-progress draft
 * stroke. Mounts inside the design's `captureRef` wrapper so drawings scroll
 * with the canvas and are baked into html-to-image captures.
 *
 * Pointer-event behavior:
 *  - tool === "none"  → pointer-events: none (iframe stays interactive).
 *  - tool === "eraser" → cursor:cell, hit-tests every shape on move.
 *  - any shape tool   → cursor:crosshair, draws a draft until pointerup.
 */
export function DrawingOverlay({ projectId, className }: DrawingOverlayProps) {
  const tool = useDrawingStore(selectTool(projectId));
  const style = useDrawingStore(selectStyle(projectId));
  const shapes = useDrawingStore(selectShapes(projectId));
  const commit = useDrawingStore((s) => s.commit);
  const eraseAt = useDrawingStore((s) => s.eraseAt);
  // Canvas zoom is applied to the captureRef wrapper as a CSS `transform:
  // scale()`, which means the SVG's getBoundingClientRect returns the
  // *visual* size (V × zoom), not its CSS userspace size. We undo the scale
  // when computing pointer coordinates so shapes are stored against the
  // unscaled iframe coordinate system — then they stay glued to the
  // underlying design when the user changes zoom.
  const zoom = useWorkspaceStore((s) => s.zoom);

  const svgRef = React.useRef<SVGSVGElement>(null);
  // Draft shape lives in local state so per-frame mousemove updates don't
  // touch the global store (which would push a history snapshot per pixel).
  const [draft, setDraft] = React.useState<Shape | null>(null);
  const draftRef = React.useRef<Shape | null>(null);
  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Track erase state so we can group an eraser stroke into one history entry.
  const erasingRef = React.useRef(false);

  // The overlay is mounted permanently inside the design so previously-drawn
  // shapes stay visible even after the user leaves Draw mode. But it must
  // only intercept pointer/wheel events while Draw mode is actually active —
  // otherwise the iframe stays click-through-blocked and the cursor sticks
  // on the crosshair after exit. Gate `interactive` on BOTH the workspace
  // tool ("draw") and the per-project drawing tool (anything but "none").
  const workspaceTool = useWorkspaceStore((s) => s.tool);
  const interactive = workspaceTool === "draw" && tool !== "none";

  const localPoint = React.useCallback(
    (e: PointerEvent | React.PointerEvent): Point | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) return;
      if (e.button !== 0) return;
      const p = localPoint(e);
      if (!p) return;
      e.preventDefault();
      svgRef.current?.setPointerCapture(e.pointerId);

      if (tool === "eraser") {
        erasingRef.current = true;
        eraseAt(projectId, (shape) => hitShape(p, shape), true);
        return;
      }

      const seed = newSeed();
      const next: Shape | null = match(tool as Exclude<DrawTool, "none" | "eraser">)
        .with("rectangle", () => ({
          id: localId(),
          type: "rectangle" as const,
          x: p.x,
          y: p.y,
          w: 0,
          h: 0,
          seed,
          style,
        }))
        .with("diamond", () => ({
          id: localId(),
          type: "diamond" as const,
          x: p.x,
          y: p.y,
          w: 0,
          h: 0,
          seed,
          style,
        }))
        .with("ellipse", () => ({
          id: localId(),
          type: "ellipse" as const,
          x: p.x,
          y: p.y,
          w: 0,
          h: 0,
          seed,
          style,
        }))
        .with("line", () => ({
          id: localId(),
          type: "line" as const,
          x1: p.x,
          y1: p.y,
          x2: p.x,
          y2: p.y,
          seed,
          style,
        }))
        .with("arrow", () => ({
          id: localId(),
          type: "arrow" as const,
          x1: p.x,
          y1: p.y,
          x2: p.x,
          y2: p.y,
          seed,
          style,
        }))
        .with("pencil", () => ({
          id: localId(),
          type: "pencil" as const,
          points: [p],
          seed,
          style,
        }))
        .exhaustive();

      setDraft(next);
    },
    [interactive, tool, style, projectId, eraseAt, localPoint],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive) return;
      const p = localPoint(e);
      if (!p) return;

      if (tool === "eraser") {
        if (!erasingRef.current) return;
        eraseAt(projectId, (shape) => hitShape(p, shape), false);
        return;
      }

      const current = draftRef.current;
      if (!current) return;

      const updated = match(current)
        .with({ type: P.union("rectangle", "diamond", "ellipse") }, (s) => ({
          ...s,
          w: p.x - s.x,
          h: p.y - s.y,
        }))
        .with({ type: P.union("line", "arrow") }, (s) => ({
          ...s,
          x2: p.x,
          y2: p.y,
        }))
        .with({ type: "pencil" }, (s) => ({
          ...s,
          points: [...s.points, p],
        }))
        .exhaustive();

      setDraft(updated as Shape);
    },
    [interactive, tool, projectId, eraseAt, localPoint],
  );

  const finishDraft = React.useCallback(() => {
    erasingRef.current = false;
    const current = draftRef.current;
    if (!current) return;
    setDraft(null);

    // Normalize: drag-from-bottom-right yields negative w/h. Also drop
    // accidental click-without-drag shapes so the canvas doesn't fill with
    // invisible 0×0 boxes the user can't even erase.
    const normalized = match(current)
      .with({ type: P.union("rectangle", "diamond", "ellipse") }, (s) => {
        const x = s.w < 0 ? s.x + s.w : s.x;
        const y = s.h < 0 ? s.y + s.h : s.y;
        const w = Math.abs(s.w);
        const h = Math.abs(s.h);
        if (w < 2 && h < 2) return null;
        return { ...s, x, y, w, h };
      })
      .with({ type: P.union("line", "arrow") }, (s) => {
        if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 2) return null;
        return s;
      })
      .with({ type: "pencil" }, (s) => {
        if (s.points.length < 2) return null;
        return s;
      })
      .exhaustive();

    if (normalized) commit(projectId, normalized);
  }, [projectId, commit]);

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      svgRef.current?.releasePointerCapture(e.pointerId);
      finishDraft();
    },
    [finishDraft],
  );

  // Wheel events that fire on the SVG don't reach the cross-origin Sandpack
  // iframe underneath, so trackpad/mouse-wheel scrolling stops working as
  // soon as a draw tool is active. We forward the delta to the iframe via
  // postMessage so its in-iframe relay (see sandpack-files.ts) can scroll
  // its own document. We don't preventDefault — that lets the parent
  // overflow-auto scroll too when the canvas is zoomed past 100%.
  //
  // ⌘/ctrl + wheel is the browser's pinch-zoom gesture though, and the
  // viewport-level handler in `useCanvasWheelZoom` consumes it to step the
  // canvas zoom. We bail out here so we don't simultaneously scroll the
  // iframe while the user is trying to zoom.
  const handleWheel = React.useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      if (!interactive) return;
      if (e.ctrlKey || e.metaKey) return;
      const captureEl = svgRef.current?.parentElement ?? null;
      const iframe = captureEl?.querySelector<HTMLIFrameElement>(
        "iframe.sp-preview-iframe, iframe",
      );
      const win = iframe?.contentWindow;
      if (!win) return;
      win.postMessage(
        {
          type: "design-scroll",
          deltaX: e.deltaX,
          deltaY: e.deltaY,
        },
        "*",
      );
    },
    [interactive],
  );

  const cursor = match(tool)
    .with("none", () => undefined)
    .with("eraser", () => "cell" as const)
    .otherwise(() => "crosshair" as const);

  // Render committed shapes + the live draft on top so the user sees what
  // they're drawing in real time.
  const drawnCommitted = React.useMemo(() => shapes.map(drawShape), [shapes]);
  const drawnDraft = React.useMemo(
    () => (draft ? drawShape(draft) : null),
    [draft],
  );

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: interactive ? "auto" : "none",
        cursor,
        // Block native pan so single-finger draw on touch devices doesn't
        // turn into a scroll gesture. Trackpad/mouse scrolling instead
        // arrives as wheel events, which we forward to the iframe in
        // onWheel below.
        touchAction: interactive ? "none" : undefined,
        // Sit above the Sandpack iframe (which doesn't carry an explicit
        // z-index but creates its own paint layer) so the drawn marks are
        // always on top of the live design. The floating shape bar uses
        // z-index 100 so it stays above the overlay too.
        zIndex: 50,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      {drawnCommitted.map((d) => (
        <g key={d.id} opacity={d.opacity}>
          {d.paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dashArray}
            />
          ))}
        </g>
      ))}
      {drawnDraft ? (
        <g opacity={drawnDraft.opacity}>
          {drawnDraft.paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dashArray}
            />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

function localId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
