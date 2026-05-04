"use client";

import { match } from "ts-pattern";

import {
  selectStyle,
  selectTool,
  useDrawingStore,
  type DrawStyle,
  type Edges,
  type Sloppiness,
  type StrokeStyle,
} from "@/stores/drawing-store";
import { DrawingSection } from "@/components/workspace/canvas/drawing/drawing-section";
import { SwatchRow } from "@/components/workspace/canvas/drawing/swatch-row";
import { StyleChip } from "@/components/workspace/canvas/drawing/style-chip";
import { SloppinessGlyph } from "@/components/workspace/canvas/drawing/sloppiness-glyph";
import type { DrawingStyleControlsProps } from "@/components/workspace/canvas/drawing/types/drawing-style-controls";

// Hand-picked palette tuned against the warm cream canvas.
const STROKE_SWATCHES = [
  { value: "#1f2937", label: "Slate" },
  { value: "#e03131", label: "Red" },
  { value: "#2f9e44", label: "Green" },
  { value: "#1971c2", label: "Blue" },
  { value: "#f08c00", label: "Orange" },
  { value: "#9c36b5", label: "Plum" },
];

const FILL_SWATCHES = [
  { value: "transparent", label: "Transparent" },
  { value: "#ffc9c9", label: "Pink" },
  { value: "#b2f2bb", label: "Mint" },
  { value: "#a5d8ff", label: "Sky" },
  { value: "#ffec99", label: "Sand" },
  { value: "#e599f7", label: "Lilac" },
];

const STROKE_WIDTHS: { value: 1 | 2 | 4; label: string }[] = [
  { value: 1, label: "Thin" },
  { value: 2, label: "Medium" },
  { value: 4, label: "Thick" },
];

const STROKE_STYLES: { value: StrokeStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

const SLOPPINESS_OPTIONS: { value: Sloppiness; label: string }[] = [
  { value: "architect", label: "Architect" },
  { value: "artist", label: "Artist" },
  { value: "cartoonist", label: "Cartoonist" },
];

const EDGES: { value: Edges; label: string }[] = [
  { value: "sharp", label: "Sharp" },
  { value: "round", label: "Round" },
];

/**
 * Style controls for the Draw tool. Designed to be embedded as Popover
 * content (no positioning of its own). Edits write straight to the drawing
 * store so the next-drawn shape uses the new style; existing shapes are not
 * retroactively restyled — this matches Excalidraw's behavior and keeps the
 * tool simple (no selection model needed).
 */
export function DrawingStyleControls({ projectId }: DrawingStyleControlsProps) {
  const drawTool = useDrawingStore(selectTool(projectId));
  const style = useDrawingStore(selectStyle(projectId));
  const setStyle = useDrawingStore((s) => s.setStyle);

  const apply = (patch: Partial<DrawStyle>) => setStyle(projectId, patch);
  // Edges only meaningfully apply to the rectangle tool (diamond/ellipse don't
  // have corner radii, lines/arrows/pencil have no corners). Hide the section
  // when it would have no effect, rather than dimming, to keep the popover
  // focused.
  const showEdges = drawTool === "rectangle";

  return (
    <div className="space-y-4">
      <DrawingSection label="Stroke">
        <SwatchRow
          options={STROKE_SWATCHES}
          value={style.strokeColor}
          onSelect={(v) => apply({ strokeColor: v })}
        />
      </DrawingSection>

      <DrawingSection label="Background">
        <SwatchRow
          options={FILL_SWATCHES}
          value={style.backgroundColor}
          onSelect={(v) => apply({ backgroundColor: v })}
        />
      </DrawingSection>

      <DrawingSection label="Stroke width">
        <div className="flex gap-1.5">
          {STROKE_WIDTHS.map((w) => (
            <StyleChip
              key={w.value}
              active={style.strokeWidth === w.value}
              onClick={() => apply({ strokeWidth: w.value })}
              aria-label={w.label}
            >
              <div
                className="rounded-full bg-ink"
                style={{ width: 22, height: w.value + 1 }}
              />
            </StyleChip>
          ))}
        </div>
      </DrawingSection>

      <DrawingSection label="Stroke style">
        <div className="flex gap-1.5">
          {STROKE_STYLES.map((s) => (
            <StyleChip
              key={s.value}
              active={style.strokeStyle === s.value}
              onClick={() => apply({ strokeStyle: s.value })}
              aria-label={s.label}
            >
              <div className="flex h-5 w-6 items-center justify-center">
                <span
                  style={{
                    width: "100%",
                    borderTop:
                      s.value === "solid"
                        ? "2px solid hsl(var(--ink))"
                        : s.value === "dashed"
                          ? "2px dashed hsl(var(--ink))"
                          : "2px dotted hsl(var(--ink))",
                  }}
                />
              </div>
            </StyleChip>
          ))}
        </div>
      </DrawingSection>

      <DrawingSection label="Sloppiness">
        <div className="flex gap-1.5">
          {SLOPPINESS_OPTIONS.map((s) => (
            <StyleChip
              key={s.value}
              active={style.sloppiness === s.value}
              onClick={() => apply({ sloppiness: s.value })}
              aria-label={s.label}
            >
              <SloppinessGlyph kind={s.value} />
            </StyleChip>
          ))}
        </div>
      </DrawingSection>

      {showEdges ? (
        <DrawingSection label="Edges">
          <div className="flex gap-1.5">
            {EDGES.map((e) => (
              <StyleChip
                key={e.value}
                active={style.edges === e.value}
                onClick={() => apply({ edges: e.value })}
                aria-label={e.label}
              >
                <div
                  className={`size-4 border-2 border-ink ${e.value === "round" ? "rounded-md" : "rounded-none"}`}
                />
              </StyleChip>
            ))}
          </div>
        </DrawingSection>
      ) : null}

      <DrawingSection label={`Opacity · ${style.opacity}%`}>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={style.opacity}
          onChange={(e) => apply({ opacity: Number(e.target.value) })}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-brand"
        />
      </DrawingSection>
    </div>
  );
}
