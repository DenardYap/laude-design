"use client";

import { cn } from "@/lib/utils";
import type { SkillTableHeaderProps } from "@/components/skills/types/skill-row";

/** Light header row that explains each column. Use as the first row in the grid. */
export function SkillTableHeader({ columns, colSpan }: SkillTableHeaderProps) {
  return (
    <li
      className="grid grid-cols-subgrid border-b border-border bg-surface-sunken/40"
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      {columns.map((c, i) => (
        <div
          key={i}
          className={cn(
            "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-subtle",
            i === 0 ? "text-left" : "text-right",
          )}
        >
          {c}
        </div>
      ))}
    </li>
  );
}
