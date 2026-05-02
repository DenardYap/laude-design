"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { createFolder } from "@/server/actions/folders";
import { createDesign } from "@/server/actions/designs";

import { FolderChildren } from "./folder-children";

interface FilesTreeProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}

/**
 * Renders the project as an explicit folder tree:
 *
 *   ▾ 📂 Project Name        ← always-present "workspace root" row
 *      │
 *      ├─ 📁 Folder
 *      │   └─ 📄 Design
 *      └─ 📄 Design
 *
 * The root row exists for the same reason VS Code shows the workspace name
 * at the top of its file explorer: it gives users a stable, named container
 * so a single file at the root still visually reads as "a file inside a
 * folder", not as a free-floating list item.
 */
export function FilesTree({
  projectId,
  projectName,
  folders,
  designs,
}: FilesTreeProps) {
  const router = useRouter();
  const openTab = useWorkspaceStore((s) => s.openDesignTab);
  const [rootExpanded, setRootExpanded] = React.useState(true);

  const newFolder = useMutation({
    mutationFn: () => createFolder(projectId, "New folder", null),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const newDesign = useMutation({
    mutationFn: () =>
      createDesign(projectId, { name: "Untitled design", folderId: null }),
    onSuccess: (d) => {
      openTab(projectId, d.id);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const isEmpty = folders.length === 0 && designs.length === 0;

  return (
    <div className="flex h-full flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            <ProjectRootRow
              name={projectName}
              expanded={rootExpanded}
              onToggle={() => setRootExpanded((v) => !v)}
            />

            {rootExpanded ? (
              isEmpty ? (
                <RootEmptyState />
              ) : (
                <FolderChildren
                  projectId={projectId}
                  parentId={null}
                  folders={folders}
                  designs={designs}
                  depth={1}
                />
              )
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => newFolder.mutate()}>
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => newDesign.mutate()}>
            <Plus className="size-3.5" />
            New design
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

interface ProjectRootRowProps {
  name: string;
  expanded: boolean;
  onToggle: () => void;
}

function ProjectRootRow({ name, expanded, onToggle }: ProjectRootRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        // Full-bleed row to read as a workspace header (not a chip). Slightly
        // bolder than child folders to anchor the hierarchy and make the
        // "everything below is inside this folder" relationship obvious.
        "group flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold text-ink",
        "hover:bg-surface-sunken/60",
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

/**
 * Empty state rendered indented under the project root, so the visual
 * relationship "this is the root folder, and it contains nothing yet" is
 * preserved even when there are zero items.
 */
function RootEmptyState() {
  return (
    <div className="relative pb-2 pl-6 pr-2 pt-1">
      {/* Same guide-line position as nested children at depth=1 (chevron
          center of the root row sits ~13px from the container's left). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 left-[13px] top-0 w-px bg-border/60"
      />
      <p className="text-xs text-ink-muted">
        No files yet — right-click anywhere or use the buttons above to create
        your first folder or design.
      </p>
    </div>
  );
}
