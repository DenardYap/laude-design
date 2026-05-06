"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import type { DesignDTO } from "@/lib/workspace/types";
import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { renameDesign, deleteDesign, moveDesign } from "@/server/actions/designs";

interface MoveDesignVars {
  designId: string;
  targetFolderId: string | null;
  designName?: string;
  targetFolderName?: string | null;
}

/**
 * Move a design to a different folder (or root) with optimistic UI.
 * Toast message is built from `designName` and `targetFolderName` when provided.
 */
export function useMoveDesign() {
  const router = useRouter();
  const setDesignFolder = useOptimisticFilesStore((s) => s.setDesignFolder);
  const clearDesignFolder = useOptimisticFilesStore((s) => s.clearDesignFolder);

  return useMutation<void, Error, MoveDesignVars>({
    mutationFn: async ({ designId, targetFolderId }) => {
      await moveDesign(designId, targetFolderId);
    },
    onMutate: ({ designId, targetFolderId }) => {
      setDesignFolder(designId, targetFolderId);
    },
    onSuccess: (_, { designName, targetFolderName }) => {
      if (designName) {
        const dest = targetFolderName != null ? `"${targetFolderName}"` : "root";
        toast.success(`Moved "${designName}" to ${dest}`);
      }
      router.refresh();
    },
    onError: (e, { designId }) => {
      clearDesignFolder(designId);
      toast.error(e instanceof Error ? e.message : "Move failed");
    },
  });
}

/**
 * Rename a design with optimistic UI.
 * `onBeforeCommit` is called in onMutate after the optimistic label is applied —
 * use it to dismiss whichever rename input is hosting the interaction.
 */
export function useRenameDesign(design: DesignDTO, opts?: { onBeforeCommit?: () => void }) {
  const router = useRouter();
  const setDesignRename = useOptimisticFilesStore((s) => s.setDesignRename);
  const clearDesignRename = useOptimisticFilesStore((s) => s.clearDesignRename);

  return useMutation({
    mutationFn: async (name: string) => {
      const next = name.trim() || "Untitled";
      await renameDesign(design.id, name);
      return next;
    },
    onMutate: (name) => {
      const next = name.trim() || "Untitled";
      setDesignRename(design.id, next);
      opts?.onBeforeCommit?.();
    },
    onSuccess: (newName) => {
      toast.success(`Renamed design to "${newName}"`);
      router.refresh();
    },
    onError: (e) => {
      clearDesignRename(design.id);
      toast.error(e instanceof Error ? e.message : "Failed to rename");
    },
  });
}

/**
 * Delete a design with optimistic UI.
 * `onBeforeDelete` is called in onMutate after the item is hidden —
 * use it to close a tab or do any other pre-deletion cleanup.
 */
export function useDeleteDesign(design: DesignDTO, opts?: { onBeforeDelete?: () => void }) {
  const router = useRouter();
  const markDesignDeleted = useOptimisticFilesStore((s) => s.markDesignDeleted);
  const unmarkDesignDeleted = useOptimisticFilesStore((s) => s.unmarkDesignDeleted);

  return useMutation({
    mutationFn: async () => {
      await deleteDesign(design.id);
      return design.name;
    },
    onMutate: () => {
      markDesignDeleted(design.id);
      opts?.onBeforeDelete?.();
    },
    onSuccess: (name) => {
      toast.success(`Deleted "${name}"`);
      router.refresh();
    },
    onError: (e) => {
      unmarkDesignDeleted(design.id);
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    },
  });
}
