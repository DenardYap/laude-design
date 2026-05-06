import type { Edges, Sloppiness, StrokeStyle } from "@/stores/drawing-store";

export const STROKE_SWATCHES = [
  { value: "#1f2937", label: "Slate" },
  { value: "#e03131", label: "Red" },
  { value: "#2f9e44", label: "Green" },
  { value: "#1971c2", label: "Blue" },
  { value: "#f08c00", label: "Orange" },
  { value: "#9c36b5", label: "Plum" },
];

export const FILL_SWATCHES = [
  { value: "transparent", label: "Transparent" },
  { value: "#ffc9c9", label: "Pink" },
  { value: "#b2f2bb", label: "Mint" },
  { value: "#a5d8ff", label: "Sky" },
  { value: "#ffec99", label: "Sand" },
  { value: "#e599f7", label: "Lilac" },
];

export const STROKE_WIDTHS: { value: 1 | 2 | 4; label: string }[] = [
  { value: 1, label: "Thin" },
  { value: 2, label: "Medium" },
  { value: 4, label: "Thick" },
];

export const STROKE_STYLES: { value: StrokeStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

export const SLOPPINESS_OPTIONS: { value: Sloppiness; label: string }[] = [
  { value: "architect", label: "Architect" },
  { value: "artist", label: "Artist" },
  { value: "cartoonist", label: "Cartoonist" },
];

export const EDGES: { value: Edges; label: string }[] = [
  { value: "sharp", label: "Sharp" },
  { value: "round", label: "Round" },
];
