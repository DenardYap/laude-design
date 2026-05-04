"use client";

import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ProjectRowProps } from "@/components/projects/types/projects";

export function ProjectRow({ project, zebra, onRequestDelete }: ProjectRowProps) {
  return (
    <li
      className={cn(
        "group relative flex items-center justify-between gap-4",
        zebra ? "bg-surface-sunken/40" : "bg-transparent",
        "hover:bg-surface-sunken",
      )}
    >
      {/* Full-row link: covers the entire row so clicking anywhere (except the
          actions menu) navigates. The visible content sits above it via z-index
          so the title text remains selectable and the arrow icon stays visible. */}
      <Link
        href={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-1.5 px-3 py-4">
        <span className="truncate text-base font-semibold tracking-tight text-ink">
          {project.name}
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="ml-3 truncate text-xs text-ink-muted">
          Updated {formatRelativeTime(project.updatedAt)}
        </span>
      </div>
      <div className="relative flex items-center pr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              aria-label={`More for ${project.name}`}
              icon={<MoreHorizontal className="size-4" />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onRequestDelete}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
