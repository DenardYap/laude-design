"use client";

export function DimWithCutout({
  sel,
  bounds,
}: {
  sel: { left: number; top: number; width: number; height: number };
  bounds: DOMRect;
}) {
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
