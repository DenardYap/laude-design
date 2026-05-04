"use client";

export function HintLabel() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-background shadow-lg">
      Drag to capture an area · Esc to cancel
    </div>
  );
}
