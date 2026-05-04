"use client";

import { match } from "ts-pattern";
import type { Sloppiness } from "@/stores/drawing-store";

/** Tiny inline preview of how each sloppiness level renders. */
export function SloppinessGlyph({ kind }: { kind: Sloppiness }) {
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
