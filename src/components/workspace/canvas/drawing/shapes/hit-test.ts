import { match } from "ts-pattern";

import type { Shape } from "@/stores/drawing-store";

/**
 * Eraser hit-tolerance in canvas-local pixels. Tuned so the user doesn't have
 * to land exactly on a thin stroke — a couple of pixels of slack matches
 * Excalidraw's behavior.
 */
const ERASE_TOLERANCE = 8;

interface Point {
  x: number;
  y: number;
}

function pointInRect(p: Point, x: number, y: number, w: number, h: number): boolean {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

function rectStroked(p: Point, x: number, y: number, w: number, h: number): boolean {
  // A point hits a (hollow) rectangle if it's within tolerance of any edge.
  const tl = { x, y };
  const tr = { x: x + w, y };
  const br = { x: x + w, y: y + h };
  const bl = { x, y: y + h };
  return (
    distanceToSegment(p, tl, tr) <= ERASE_TOLERANCE ||
    distanceToSegment(p, tr, br) <= ERASE_TOLERANCE ||
    distanceToSegment(p, br, bl) <= ERASE_TOLERANCE ||
    distanceToSegment(p, bl, tl) <= ERASE_TOLERANCE
  );
}

function diamondStroked(p: Point, x: number, y: number, w: number, h: number): boolean {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const top = { x: cx, y };
  const right = { x: x + w, y: cy };
  const bottom = { x: cx, y: y + h };
  const left = { x, y: cy };
  return (
    distanceToSegment(p, top, right) <= ERASE_TOLERANCE ||
    distanceToSegment(p, right, bottom) <= ERASE_TOLERANCE ||
    distanceToSegment(p, bottom, left) <= ERASE_TOLERANCE ||
    distanceToSegment(p, left, top) <= ERASE_TOLERANCE
  );
}

function ellipseStroked(p: Point, x: number, y: number, w: number, h: number): boolean {
  // Approximate ellipse stroke proximity by comparing the normalized squared
  // radius to 1 (within the tolerance band). Cheap but good enough for an
  // eraser.
  const rx = w / 2;
  const ry = h / 2;
  if (rx <= 0 || ry <= 0) return false;
  const cx = x + rx;
  const cy = y + ry;
  const nx = (p.x - cx) / rx;
  const ny = (p.y - cy) / ry;
  const r2 = nx * nx + ny * ny;
  // tolerance scaled by the smaller radius — gives roughly ERASE_TOLERANCE px
  // of band thickness on screen.
  const tol = ERASE_TOLERANCE / Math.min(rx, ry);
  const lo = Math.max(0, 1 - tol);
  const hi = (1 + tol) * (1 + tol);
  return r2 >= lo * lo && r2 <= hi;
}

/**
 * Returns true if the eraser cursor at `p` should remove this shape.
 *
 * Filled shapes (background !== "transparent") count as solid hits anywhere
 * inside the bounding region; hollow shapes only count when the cursor
 * grazes the stroke. This mirrors Excalidraw's behavior so users don't have
 * to laser-aim at a 1-pixel outline.
 */
export function hitShape(p: Point, shape: Shape): boolean {
  const filled =
    "style" in shape && shape.style.backgroundColor !== "transparent";

  return match(shape)
    .with({ type: "rectangle" }, (s) => {
      if (filled) return pointInRect(p, s.x, s.y, s.w, s.h);
      return rectStroked(p, s.x, s.y, s.w, s.h);
    })
    .with({ type: "diamond" }, (s) => {
      if (filled) return pointInRect(p, s.x, s.y, s.w, s.h);
      return diamondStroked(p, s.x, s.y, s.w, s.h);
    })
    .with({ type: "ellipse" }, (s) => {
      if (filled) return pointInRect(p, s.x, s.y, s.w, s.h);
      return ellipseStroked(p, s.x, s.y, s.w, s.h);
    })
    .with({ type: "line" }, (s) =>
      distanceToSegment(p, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) <=
      ERASE_TOLERANCE,
    )
    .with({ type: "arrow" }, (s) =>
      distanceToSegment(p, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) <=
      ERASE_TOLERANCE,
    )
    .with({ type: "pencil" }, (s) => {
      for (let i = 0; i < s.points.length - 1; i++) {
        if (distanceToSegment(p, s.points[i], s.points[i + 1]) <= ERASE_TOLERANCE) {
          return true;
        }
      }
      return false;
    })
    .exhaustive();
}
