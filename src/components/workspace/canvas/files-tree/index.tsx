"use client";

import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FolderPlus, Plus } from "lucide-react";
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
import {
  nextPendingDesignId,
  nextPendingFolderId,
  useOptimisticFilesStore,
} from "@/stores/optimistic-files-store";
import { createFolder, moveFolder } from "@/server/actions/folders";
import { createDesign, moveDesign } from "@/server/actions/designs";

import { FolderChildren } from "./folder-children";
import { ProjectRootRow } from "@/components/workspace/canvas/files-tree/project-root-row";
import { RootEmptyState } from "@/components/workspace/canvas/files-tree/root-empty-state";
import type { FilesTreeProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

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
  const addPendingFolder = useOptimisticFilesStore((s) => s.addPendingFolder);
  const addPendingDesign = useOptimisticFilesStore((s) => s.addPendingDesign);
  const confirmPendingFolder = useOptimisticFilesStore(
    (s) => s.confirmPendingFolder,
  );
  const confirmPendingDesign = useOptimisticFilesStore(
    (s) => s.confirmPendingDesign,
  );
  const dropPendingFolder = useOptimisticFilesStore(
    (s) => s.dropPendingFolder,
  );
  const dropPendingDesign = useOptimisticFilesStore(
    (s) => s.dropPendingDesign,
  );
  const setFolderParent = useOptimisticFilesStore((s) => s.setFolderParent);
  const clearFolderParent = useOptimisticFilesStore((s) => s.clearFolderParent);
  const setDesignFolder = useOptimisticFilesStore((s) => s.setDesignFolder);
  const clearDesignFolder = useOptimisticFilesStore((s) => s.clearDesignFolder);
  const [rootExpanded, setRootExpanded] = useState(true);
  const [rootDropTarget, setRootDropTarget] = useState(false);

  const rootClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (rootClearTimer.current) clearTimeout(rootClearTimer.current);
    };
  }, []);

  function bumpRootDropHighlight() {
    setRootDropTarget(true);
    if (rootClearTimer.current) clearTimeout(rootClearTimer.current);
    rootClearTimer.current = setTimeout(() => setRootDropTarget(false), 120);
  }

  async function handleRootDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (rootClearTimer.current) clearTimeout(rootClearTimer.current);
    setRootDropTarget(false);

    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [kind, id] = data.split(":");

    if (kind === "design") {
      const design = designs.find((d) => d.id === id);
      if (!design || design.folderId === null) return;
      setDesignFolder(id, null);
      try {
        await moveDesign(id, null);
        toast.success(`Moved "${design.name}" to root`);
        router.refresh();
      } catch (err) {
        clearDesignFolder(id);
        toast.error(err instanceof Error ? err.message : "Move failed");
      }
      return;
    }

    if (kind === "folder") {
      const folder = folders.find((f) => f.id === id);
      if (!folder || folder.parentId === null) return;
      setFolderParent(id, null);
      try {
        await moveFolder(id, null);
        toast.success(`Moved "${folder.name}" to root`);
        router.refresh();
      } catch (err) {
        clearFolderParent(id);
        toast.error(err instanceof Error ? err.message : "Move failed");
      }
    }
  }

  const newFolder = useMutation({
    // Capture the temp id so `onSuccess` / `onError` can reference the same
    // entry we optimistically inserted in `onMutate`.
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const folder = await createFolder(projectId, "New folder", null);
      return { tempId, folder };
    },
    onMutate: ({ tempId }) => {
      addPendingFolder({ id: tempId, name: "New folder", parentId: null });
    },
    onSuccess: ({ tempId, folder }) => {
      confirmPendingFolder(tempId, {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
      });
      toast.success("Folder created");
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingFolder(tempId);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });
  const newDesign = useMutation({
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const design = await createDesign(projectId, {
        name: "Untitled design",
        folderId: null,
      });
      return { tempId, design };
    },
    onMutate: ({ tempId }) => {
      addPendingDesign({
        id: tempId,
        name: "Untitled design",
        folderId: null,
        files: [],
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: ({ tempId, design }) => {
      confirmPendingDesign(tempId, design);
      openTab(projectId, design.id);
      toast.success("Design created");
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingDesign(tempId);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });

  const isEmpty = folders.length === 0 && designs.length === 0;

  return (
    <div className="flex h-full flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 space-y-0.5 overflow-y-auto p-2"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              bumpRootDropHighlight();
            }}
            onDrop={handleRootDrop}
          >
            <ProjectRootRow
              name={projectName}
              expanded={rootExpanded}
              onToggle={() => setRootExpanded((v) => !v)}
              dropTarget={rootDropTarget}
            />

            {rootExpanded ? (
              isEmpty ? (
                <RootEmptyState />
              ) : (
                <>
                  <FolderChildren
                    projectId={projectId}
                    parentId={null}
                    folders={folders}
                    designs={designs}
                    depth={1}
                  />
                  {/* Catchment strip: inside the root drop boundary but below all
                      children, so drags to the bottom of the tree still route to root. */}
                  <div style={{ height: 6 }} />
                </>
              )
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => newFolder.mutate({ tempId: nextPendingFolderId() })}
          >
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => newDesign.mutate({ tempId: nextPendingDesignId() })}
          >
            <Plus className="size-3.5" />
            New design
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

