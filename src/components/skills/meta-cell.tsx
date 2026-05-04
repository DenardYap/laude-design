"use client";

import { cn } from "@/lib/utils";
import type { MetaCellProps } from "@/components/skills/types/skill-row";

/** Right-aligned data cell. Use one per column; participates in the parent subgrid. */
export function MetaCell({ children, className }: MetaCellProps) {
  return (
    <div
      className={cn(
        "pointer-events-none relative flex items-center justify-end px-3 text-xs text-ink-muted tabular-nums",
        className,
      )}
    >
      {children}
    </div>
  );
}
