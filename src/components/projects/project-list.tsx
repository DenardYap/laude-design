"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataList, type DataListItem } from "@/components/shared/data-list";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useScopeFilters } from "@/stores/filters-store";
import { formatRelativeTime } from "@/lib/utils";
import { deleteProject } from "@/server/actions/projects";

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: Date | string;
}

interface ProjectListProps {
  projects: ProjectListItem[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const { query } = useScopeFilters("projects");
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<ProjectListItem | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const items: DataListItem[] = filtered.map((p) => ({
    id: p.id,
    title: p.name,
    subtitle: `last updated: ${formatRelativeTime(p.updatedAt)}`,
    actions: (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`More for ${p.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setPendingDelete(p)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }));

  return (
    <>
      <DataList items={items} />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete project?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed permanently.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
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
