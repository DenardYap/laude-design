import type { RGB, Bristle } from "@/components/landing/types/paint-canvas";

// Warm palette aligned with the brand cream + complementary accents.
export const PALETTE: RGB[] = [
  { r: 218, g: 138, b: 47 }, // amber
  { r: 199, g: 70, b: 38 }, // terracotta
  { r: 96, g: 130, b: 92 }, // sage
  { r: 196, g: 100, b: 130 }, // dusty rose
  { r: 78, g: 110, b: 154 }, // slate blue
  { r: 132, g: 88, b: 142 }, // plum
];

export const BRUSH_RADIUS = 13;
export const BRISTLE_COUNT = 18;

export const TIP_X = 8;
export const TIP_Y = 52;

export function makeBristles(): Bristle[] {
  const out: Bristle[] = [];
  for (let i = 0; i < BRISTLE_COUNT; i++) {
    const t = (i + 0.5) / BRISTLE_COUNT;
    const offset = (t - 0.5) * 2;
    // A gentle dome over the center keeps strokes denser in the middle and
    // wispier at the edges, mimicking a real splayed brush head.
    const dome = 1 - Math.abs(offset);
    out.push({
      offset: offset + (Math.random() - 0.5) * 0.06,
      width: 0.55 + Math.random() * 1.1,
      alpha: 0.16 + dome * 0.55 + Math.random() * 0.18,
    });
  }
  return out;
}
