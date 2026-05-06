"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import type { FolderDTO } from "@/lib/workspace/types";
import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { renameFolder, deleteFolder, moveFolder } from "@/server/actions/folders";

/**
 * Rename a folder with optimistic UI.
 * `onBeforeCommit` is called in onMutate after the optimistic label is applied —
 * use it to dismiss whichever rename input is hosting the interaction.
 */
export function useRenameFolder(folder: FolderDTO, opts?: { onBeforeCommit?: () => void }) {
  const router = useRouter();
  const setFolderRename = useOptimisticFilesStore((s) => s.setFolderRename);
  const clearFolderRename = useOptimisticFilesStore((s) => s.clearFolderRename);

  return useMutation({
    mutationFn: async (name: string) => {
      const next = name.trim().slice(0, 80) || "Untitled";
      await renameFolder(folder.id, next);
      return next;
    },
    onMutate: (name) => {
      const next = name.trim().slice(0, 80) || "Untitled";
      setFolderRename(folder.id, next);
      opts?.onBeforeCommit?.();
    },
    onSuccess: (newName) => {
      toast.success(`Renamed folder to "${newName}"`);
      router.refresh();
    },
    onError: (e) => {
      clearFolderRename(folder.id);
      toast.error(e instanceof Error ? e.message : "Failed to rename");
    },
  });
}

/**
 * Delete a folder with optimistic UI.
 * `onBeforeDelete` is called in onMutate after the folder is hidden —
 * use it for any pre-deletion cleanup.
 */
export function useDeleteFolder(folder: FolderDTO, opts?: { onBeforeDelete?: () => void }) {
  const router = useRouter();
  const markFolderDeleted = useOptimisticFilesStore((s) => s.markFolderDeleted);
  const unmarkFolderDeleted = useOptimisticFilesStore((s) => s.unmarkFolderDeleted);

  return useMutation({
    mutationFn: async () => {
      await deleteFolder(folder.id);
      return folder.name;
    },
    onMutate: () => {
      markFolderDeleted(folder.id);
      opts?.onBeforeDelete?.();
    },
    onSuccess: (name) => {
      toast.success(`Deleted "${name}"`);
      router.refresh();
    },
    onError: (e) => {
      unmarkFolderDeleted(folder.id);
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    },
  });
}

interface MoveFolderVars {
  folderId: string;
  targetParentId: string | null;
  folderName?: string;
  targetFolderName?: string | null;
}

/**
 * Move a folder to a different parent (or root) with optimistic UI.
 * Toast message is built from `folderName` and `targetFolderName` when provided.
 */
export function useMoveFolder() {
  const router = useRouter();
  const setFolderParent = useOptimisticFilesStore((s) => s.setFolderParent);
  const clearFolderParent = useOptimisticFilesStore((s) => s.clearFolderParent);

  return useMutation<void, Error, MoveFolderVars>({
    mutationFn: async ({ folderId, targetParentId }) => {
      await moveFolder(folderId, targetParentId);
    },
    onMutate: ({ folderId, targetParentId }) => {
      setFolderParent(folderId, targetParentId);
    },
    onSuccess: (_, { folderName, targetFolderName }) => {
      if (folderName) {
        const dest = targetFolderName != null ? `"${targetFolderName}"` : "root";
        toast.success(`Moved "${folderName}" to ${dest}`);
      }
      router.refresh();
    },
    onError: (e, { folderId }) => {
      clearFolderParent(folderId);
      toast.error(e instanceof Error ? e.message : "Move failed");
    },
  });
}
