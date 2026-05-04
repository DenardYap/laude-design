"use client";

import { BrushMark, IconBadge } from "@/components/ui";
import type { EmptyCanvasProps } from "@/components/workspace/canvas/types/misc";

export function EmptyCanvas({
  message = "Start painting with your agent",
}: EmptyCanvasProps = {}) {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-canvas"
      style={{
        backgroundImage:
          "radial-gradient(hsl(var(--canvas-grid)) 0.6px, transparent 0.6px)",
        backgroundSize: "5px 5px",
      }}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <IconBadge tone="soft" size="xl" shape="circle" icon={<BrushMark />} />
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
    </div>
  );
}
