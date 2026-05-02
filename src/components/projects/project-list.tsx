"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from "@/components/ui";
import { match } from "ts-pattern";

import { useScopeFilters } from "@/stores/filters-store";
import { cn, formatRelativeTime } from "@/lib/utils";
import { deleteProject } from "@/server/actions/projects";

type RecencyBucket = "today" | "week" | "month" | "older";

// Bucket a project by how recently it was updated, relative to "now". Buckets
// are mutually exclusive — a project counts once, in the narrowest bucket it
// fits into.
function bucketByRecency(updatedAt: Date | string, now: number): RecencyBucket {
  const ts = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
  const ageMs = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return "today";
  if (ageMs < 7 * day) return "week";
  if (ageMs < 30 * day) return "month";
  return "older";
}

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: Date | string;
}

interface ProjectListProps {
  projects: ProjectListItem[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const { query, filters } = useScopeFilters("projects");
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<ProjectListItem | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeBuckets = new Set(filters as RecencyBucket[]);
    const now = Date.now();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (activeBuckets.size > 0 && !activeBuckets.has(bucketByRecency(p.updatedAt, now)))
        return false;
      return true;
    });
  }, [projects, query, filters]);

  if (filtered.length === 0) {
    const reason = match({ hasQuery: query.trim().length > 0, hasFilter: filters.length > 0 })
      .with({ hasQuery: true, hasFilter: true }, () => "No projects match your search and filters.")
      .with({ hasQuery: true, hasFilter: false }, () => "No projects match your search.")
      .with({ hasQuery: false, hasFilter: true }, () => "No projects in the selected time range.")
      .otherwise(() => "No projects yet.");
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
        {reason}
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col overflow-hidden rounded-lg border border-border">
        {filtered.map((project, idx) => (
          <ProjectRow
            key={project.id}
            project={project}
            zebra={idx % 2 === 1}
            onRequestDelete={() => setPendingDelete(project)}
          />
        ))}
      </ul>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete project?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" and its sessions will be removed permanently. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteProject(pendingDelete.id);
            toast.success("Project deleted");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to delete");
          }
        }}
      />
    </>
  );
}

interface ProjectRowProps {
  project: ProjectListItem;
  zebra: boolean;
  onRequestDelete: () => void;
}

function ProjectRow({ project, zebra, onRequestDelete }: ProjectRowProps) {
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
