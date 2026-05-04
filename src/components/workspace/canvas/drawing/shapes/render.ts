import rough from "roughjs";
import type { Options as RoughOptions, PathInfo } from "roughjs/bin/core";
import type { RoughGenerator } from "roughjs/bin/generator";
import { match } from "ts-pattern";

import type {
  DrawStyle,
  Edges,
  Shape,
  Sloppiness,
  StrokeStyle,
} from "@/stores/drawing-store";

// Single shared RoughGenerator. It's stateless beyond config, so a singleton
// avoids re-allocating per render and per shape.
let _generator: RoughGenerator | null = null;
function getGenerator(): RoughGenerator {
  if (!_generator) _generator = rough.generator();
  return _generator;
}

const ROUGHNESS_BY_SLOPPINESS: Record<Sloppiness, number> = {
  architect: 0.5,
  artist: 1.5,
  cartoonist: 3,
};

/**
 * Map a stroke style to rough.js' dash array. Pure-rough.js dash support is
 * patchy (it draws sloppy *stroke* segments, not pretty SVG dashes), so we
 * configure both rough's strokeLineDash AND the rendered <path> dasharray as
 * a fallback for very small shapes.
 */
function dashArrayFor(
  style: StrokeStyle,
  strokeWidth: number,
): number[] | undefined {
  if (style === "solid") return undefined;
  if (style === "dashed") return [strokeWidth * 4, strokeWidth * 3];
  return [strokeWidth, strokeWidth * 2];
}

function buildOptions(style: DrawStyle): RoughOptions {
  const dash = dashArrayFor(style.strokeStyle, style.strokeWidth);
  const opts: RoughOptions = {
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    roughness: ROUGHNESS_BY_SLOPPINESS[style.sloppiness],
    bowing: 1,
    // Without disableMultiStroke, every shape gets two overlapping rough
    // strokes — which looks great for filled boxes but doubles up annoyingly
    // on dotted/dashed lines. Single-stroke when not solid.
    disableMultiStroke: style.strokeStyle !== "solid",
  };
  if (dash) {
    opts.strokeLineDash = dash;
  }
  if (style.backgroundColor !== "transparent") {
    opts.fill = style.backgroundColor;
    opts.fillStyle = "hachure";
    opts.fillWeight = Math.max(0.5, style.strokeWidth * 0.5);
    opts.hachureGap = Math.max(4, style.strokeWidth * 4);
  }
  return opts;
}

interface DrawnPath {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill: string;
  /** SVG dash-array for the rendered <path>, separate from rough's stroke. */
  dashArray?: string;
}

export interface DrawnShape {
  id: string;
  paths: DrawnPath[];
  /** 0..1 group opacity (we keep style.opacity as 0..100 for the slider UX). */
  opacity: number;
}

function pathInfosToDrawn(
  pathInfos: PathInfo[],
  style: DrawStyle,
): DrawnPath[] {
  const dash = dashArrayFor(style.strokeStyle, style.strokeWidth);
  const dashArray = dash?.join(" ");
  return pathInfos.map((p) => ({
    d: p.d,
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    fill: p.fill ?? "none",
    dashArray,
  }));
}

function diamondPoints(
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number][] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    [cx, y],
    [x + w, cy],
    [cx, y + h],
    [x, cy],
  ];
}

function rectanglePath(
  generator: RoughGenerator,
  x: number,
  y: number,
  w: number,
  h: number,
  edges: Edges,
  options: RoughOptions,
): PathInfo[] {
  if (edges === "sharp") {
    return generator.toPaths(generator.rectangle(x, y, w, h, options));
  }
  // Rounded rectangle drawn as an SVG path so rough.js bowing still applies.
  // Min radius keeps the corners visually rounded but avoids over-rounding
  // tiny shapes.
  const r = Math.min(16, w / 4, h / 4);
  const d = [
    `M${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h - r}`,
    `Q${x + w},${y + h} ${x + w - r},${y + h}`,
    `L${x + r},${y + h}`,
    `Q${x},${y + h} ${x},${y + h - r}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    "Z",
  ].join(" ");
  return generator.toPaths(generator.path(d, options));
}

function arrowHeadPaths(
  generator: RoughGenerator,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: RoughOptions,
): PathInfo[] {
  // Standard 30-degree arrowhead. Length scales with the arrow's length so
  // short arrows still get a proportional head.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return [];
  const headLen = Math.min(24, Math.max(10, length * 0.18));
  const angle = Math.atan2(dy, dx);
  const angleA = angle + Math.PI - Math.PI / 6;
  const angleB = angle + Math.PI + Math.PI / 6;
  const ax = x2 + Math.cos(angleA) * headLen;
  const ay = y2 + Math.sin(angleA) * headLen;
  const bx = x2 + Math.cos(angleB) * headLen;
  const by = y2 + Math.sin(angleB) * headLen;
  return [
    ...generator.toPaths(generator.line(x2, y2, ax, ay, options)),
    ...generator.toPaths(generator.line(x2, y2, bx, by, options)),
  ];
}

export function drawShape(shape: Shape): DrawnShape {
  const generator = getGenerator();
  const opts = { ...buildOptions(shape.style), seed: shape.seed };

  const paths = match(shape)
    .with({ type: "rectangle" }, (s) => {
      const x = s.w < 0 ? s.x + s.w : s.x;
      const y = s.h < 0 ? s.y + s.h : s.y;
      const w = Math.abs(s.w);
      const h = Math.abs(s.h);
      return pathInfosToDrawn(
        rectanglePath(generator, x, y, w, h, s.style.edges, opts),
        s.style,
      );
    })
    .with({ type: "diamond" }, (s) => {
      const x = s.w < 0 ? s.x + s.w : s.x;
      const y = s.h < 0 ? s.y + s.h : s.y;
      const w = Math.abs(s.w);
      const h = Math.abs(s.h);
      return pathInfosToDrawn(
        generator.toPaths(generator.polygon(diamondPoints(x, y, w, h), opts)),
        s.style,
      );
    })
    .with({ type: "ellipse" }, (s) => {
      const w = Math.abs(s.w);
      const h = Math.abs(s.h);
      const cx = s.w < 0 ? s.x - w / 2 : s.x + w / 2;
      const cy = s.h < 0 ? s.y - h / 2 : s.y + h / 2;
      return pathInfosToDrawn(
        generator.toPaths(generator.ellipse(cx, cy, w, h, opts)),
        s.style,
      );
    })
    .with({ type: "line" }, (s) =>
      pathInfosToDrawn(
        generator.toPaths(generator.line(s.x1, s.y1, s.x2, s.y2, opts)),
        s.style,
      ),
    )
    .with({ type: "arrow" }, (s) => [
      ...pathInfosToDrawn(
        generator.toPaths(generator.line(s.x1, s.y1, s.x2, s.y2, opts)),
        s.style,
      ),
      ...pathInfosToDrawn(
        arrowHeadPaths(generator, s.x1, s.y1, s.x2, s.y2, opts),
        s.style,
      ),
    ])
    .with({ type: "pencil" }, (s) => {
      if (s.points.length < 2) return [];
      // Pencil ignores the rough generator's randomness because the input
      // points are already organic. Render a smooth quadratic curve.
      const d = pencilPath(s.points);
      return [
        {
          d,
          stroke: s.style.strokeColor,
          strokeWidth: s.style.strokeWidth,
          fill: "none",
          dashArray: dashArrayFor(s.style.strokeStyle, s.style.strokeWidth)?.join(
            " ",
          ),
        },
      ];
    })
    .exhaustive();

  return {
    id: shape.id,
    paths,
    opacity: Math.max(0, Math.min(1, shape.style.opacity / 100)),
  };
}

/** Convert a polyline of mouse points to a smoothed SVG path. */
export function pencilPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M${p.x},${p.y} L${p.x + 0.1},${p.y + 0.1}`;
  }
  const d: string[] = [`M${points[0].x},${points[0].y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const mx = (cur.x + next.x) / 2;
    const my = (cur.y + next.y) / 2;
    d.push(`Q${cur.x},${cur.y} ${mx},${my}`);
  }
  const last = points[points.length - 1];
  d.push(`L${last.x},${last.y}`);
  return d.join(" ");
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
