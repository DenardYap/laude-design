"use client";

import type { DragEvent } from "react";

import { toast } from "sonner";

import { isDescendantOf } from "@/components/workspace/canvas/files-tree/utils";
import { useMoveDesign } from "@/components/workspace/canvas/hooks/use-design-mutations";
import { useMoveFolder } from "@/components/workspace/canvas/hooks/use-folder-mutations";
import type { UseDropIntoFolderOptions } from "@/components/workspace/canvas/types/use-drop-into-folder";

/**
 * Returns a `handleDrop` that moves dragged designs/folders into
 * `targetFolderId` (or root when `null`). Shared by the root drop zone in
 * FilesTree and each per-folder drop zone in FolderRow.
 *
 * Callers are responsible for clearing their own drop-highlight state before
 * or after calling the returned handler.
 */
export function useDropIntoFolder({
  targetFolderId,
  targetFolderName,
  folders,
  designs,
}: UseDropIntoFolderOptions) {
  const moveDesignMutation = useMoveDesign();
  const moveFolderMutation = useMoveFolder();

  return function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [kind, id] = data.split(":");

    if (kind === "design") {
      const design = designs.find((d) => d.id === id);
      // Skip no-op: design already lives at the target.
      if (targetFolderId === null && (!design || design.folderId === null)) return;
      moveDesignMutation.mutate({
        designId: id,
        targetFolderId,
        designName: design?.name,
        targetFolderName,
      });
      return;
    }

    if (kind === "folder") {
      // Prevent dropping a folder onto itself.
      if (id === targetFolderId) return;
      // Prevent circular moves (dropping an ancestor into its own descendant).
      if (targetFolderId !== null && isDescendantOf(targetFolderId, id, folders)) {
        toast.error("Can't move a folder into itself");
        return;
      }
      const moved = folders.find((f) => f.id === id);
      // Skip no-op: folder already lives at the target.
      if (targetFolderId === null && (!moved || moved.parentId === null)) return;
      moveFolderMutation.mutate({
        folderId: id,
        targetParentId: targetFolderId,
        folderName: moved?.name,
        targetFolderName,
      });
    }
  };
}
