"use client";

import { ChevronDown, ChevronRight, FolderClosed, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectRootRowProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

export function ProjectRootRow({ name, expanded, onToggle, dropTarget }: ProjectRootRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "group flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold text-ink",
        "hover:bg-surface-sunken/60",
        dropTarget && "bg-surface-sunken ring-1 ring-border-strong hover:bg-surface-sunken",
      )}
    >
      {expanded ? (
        <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
      ) : (
        <ChevronRight className="size-3.5 shrink-0 text-ink-muted" />
      )}
      {expanded ? (
        <FolderOpen className="size-3.5 shrink-0 text-ink" />
      ) : (
        <FolderClosed className="size-3.5 shrink-0 text-ink" />
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}
