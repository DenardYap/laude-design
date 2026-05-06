"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { createFolder } from "@/server/actions/folders";
import type { CreateFolderVars } from "@/components/workspace/canvas/types/use-create-folder";

export type { CreateFolderVars };

export function useCreateFolder(projectId: string) {
  const router = useRouter();
  const addPendingFolder = useOptimisticFilesStore((s) => s.addPendingFolder);
  const confirmPendingFolder = useOptimisticFilesStore((s) => s.confirmPendingFolder);
  const dropPendingFolder = useOptimisticFilesStore((s) => s.dropPendingFolder);

  return useMutation({
    mutationFn: async ({ tempId, parentId }: CreateFolderVars) => {
      const folder = await createFolder(projectId, "New folder", parentId);
      return { tempId, folder };
    },
    onMutate: ({ tempId, parentId }) => {
      addPendingFolder({ id: tempId, name: "New folder", parentId });
    },
    onSuccess: ({ tempId, folder }, { successMessage }) => {
      confirmPendingFolder(tempId, folder);
      toast.success(successMessage ?? "Folder created");
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingFolder(tempId);
      toast.error(e instanceof Error ? e.message : "Failed to create folder");
    },
  });
}
