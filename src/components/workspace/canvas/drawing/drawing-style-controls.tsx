"use client";

import { match } from "ts-pattern";

import { cn } from "@/lib/utils";
import {
  selectStyle,
  selectTool,
  useDrawingStore,
  type DrawStyle,
  type Edges,
  type Sloppiness,
  type StrokeStyle,
} from "@/stores/drawing-store";

interface DrawingStyleControlsProps {
  projectId: string;
}

// Hand-picked palette tuned against the warm cream canvas. Excalidraw's
// classic five (red/green/blue/orange/black) plus a brand-match warm yellow
// so freshly-applied marks read as "drawn on top" rather than "part of the
// design".
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
      <Section label="Stroke">
        <SwatchRow
          options={STROKE_SWATCHES}
          value={style.strokeColor}
          onSelect={(v) => apply({ strokeColor: v })}
        />
      </Section>

      <Section label="Background">
        <SwatchRow
          options={FILL_SWATCHES}
          value={style.backgroundColor}
          onSelect={(v) => apply({ backgroundColor: v })}
        />
      </Section>

      <Section label="Stroke width">
        <div className="flex gap-1.5">
          {STROKE_WIDTHS.map((w) => (
            <Chip
              key={w.value}
              active={style.strokeWidth === w.value}
              onClick={() => apply({ strokeWidth: w.value })}
              aria-label={w.label}
            >
              <div
                className="rounded-full bg-ink"
                style={{ width: 22, height: w.value + 1 }}
              />
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Stroke style">
        <div className="flex gap-1.5">
          {STROKE_STYLES.map((s) => (
            <Chip
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
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Sloppiness">
        <div className="flex gap-1.5">
          {SLOPPINESS_OPTIONS.map((s) => (
            <Chip
              key={s.value}
              active={style.sloppiness === s.value}
              onClick={() => apply({ sloppiness: s.value })}
              aria-label={s.label}
            >
              <SloppinessGlyph kind={s.value} />
            </Chip>
          ))}
        </div>
      </Section>

      {showEdges ? (
        <Section label="Edges">
          <div className="flex gap-1.5">
            {EDGES.map((e) => (
              <Chip
                key={e.value}
                active={style.edges === e.value}
                onClick={() => apply({ edges: e.value })}
                aria-label={e.label}
              >
                <div
                  className={cn(
                    "size-4 border-2 border-ink",
                    e.value === "round" ? "rounded-md" : "rounded-none",
                  )}
                />
              </Chip>
            ))}
          </div>
        </Section>
      ) : null}

      <Section label={`Opacity · ${style.opacity}%`}>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={style.opacity}
          onChange={(e) => apply({ opacity: Number(e.target.value) })}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-brand"
        />
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function SwatchRow({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isTransparent = opt.value === "transparent";
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-label={opt.label}
            aria-pressed={selected}
            className={cn(
              "size-6 rounded-md border border-border transition-shadow",
              selected && "ring-2 ring-brand ring-offset-1 ring-offset-surface",
            )}
            style={{
              backgroundColor: isTransparent ? undefined : opt.value,
              backgroundImage: isTransparent
                ? "linear-gradient(45deg, hsl(var(--surface-sunken)) 25%, transparent 25%, transparent 75%, hsl(var(--surface-sunken)) 75%), linear-gradient(45deg, hsl(var(--surface-sunken)) 25%, transparent 25%, transparent 75%, hsl(var(--surface-sunken)) 75%)"
                : undefined,
              backgroundSize: isTransparent ? "8px 8px" : undefined,
              backgroundPosition: isTransparent ? "0 0, 4px 4px" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-surface px-2 text-xs text-ink transition-colors hover:bg-surface-sunken",
        active && "border-brand bg-brand-soft hover:bg-brand-soft",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Tiny inline preview of how each sloppiness level renders. */
function SloppinessGlyph({ kind }: { kind: Sloppiness }) {
  const d = match(kind)
    .with("architect", () => "M2 8 L22 8")
    .with("artist", () => "M2 8 Q7 5 12 8 T22 8")
    .with("cartoonist", () => "M2 8 Q5 4 9 9 T15 7 T22 9")
    .exhaustive();
  return (
    <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true">
      <path
        d={d}
        stroke="hsl(var(--ink))"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
