"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { ConfirmDialog } from "@/components/ui";
import { useScopeQuery, useScopeDimension } from "@/stores/filters-store";
import { deleteProject } from "@/server/actions/projects";
import { ProjectRow } from "@/components/projects/project-row";
import { bucketByRecency } from "@/components/projects/utils/projects";
import type { ProjectListItem, ProjectListProps, RecencyBucket } from "@/components/projects/types/projects";

export type { ProjectListItem } from "@/components/projects/types/projects";

export function ProjectList({ projects }: ProjectListProps) {
  const { query } = useScopeQuery("projects");
  const { values: recencyValues } = useScopeDimension("projects", "recency");
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeBuckets = new Set(recencyValues as RecencyBucket[]);
    const now = Date.now();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (activeBuckets.size > 0 && !activeBuckets.has(bucketByRecency(p.updatedAt, now)))
        return false;
      return true;
    });
  }, [projects, query, recencyValues]);

  if (filtered.length === 0) {
    const reason = match({ hasQuery: query.trim().length > 0, hasFilter: recencyValues.length > 0 })
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
