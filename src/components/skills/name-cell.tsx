"use client";

import { ArrowUpRight } from "lucide-react";
import type { NameCellProps } from "@/components/skills/types/skill-row";

/** First column: bold name + truncated description, with the hover arrow affordance. */
export function NameCell({ name, description }: NameCellProps) {
  return (
    <div className="pointer-events-none relative flex min-w-0 items-center gap-1.5 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold tracking-tight text-ink">
            {name}
          </span>
          <ArrowUpRight className="size-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        {description ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
