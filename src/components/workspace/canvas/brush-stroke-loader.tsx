"use client";

export function BrushStrokeLoader() {
  const curve = "M14 42 Q40 8 60 30 T106 22";
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      aria-hidden="true"
      className="h-16 w-32 text-brand-hover"
    >
      <path
        d={curve}
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        pathLength={100}
        className="paint-loader-stroke"
      />
      <circle
        cx={0}
        cy={0}
        r={4}
        fill="hsl(var(--brand-foreground))"
        className="paint-loader-brush"
        style={{ offsetPath: `path("${curve}")` }}
      />
    </svg>
  );
}
