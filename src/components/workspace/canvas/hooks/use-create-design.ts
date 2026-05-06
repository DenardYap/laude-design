"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { createDesign } from "@/server/actions/designs";
import type { CreateDesignVars } from "@/components/workspace/canvas/types/use-create-design";

export type { CreateDesignVars };

export function useCreateDesign(projectId: string) {
  const router = useRouter();
  const openDesignTab = useWorkspaceStore((s) => s.openDesignTab);
  const addPendingDesign = useOptimisticFilesStore((s) => s.addPendingDesign);
  const confirmPendingDesign = useOptimisticFilesStore((s) => s.confirmPendingDesign);
  const dropPendingDesign = useOptimisticFilesStore((s) => s.dropPendingDesign);

  return useMutation({
    mutationFn: async ({ tempId, folderId }: CreateDesignVars) => {
      const design = await createDesign(projectId, { name: "Untitled design", folderId });
      return { tempId, design };
    },
    onMutate: ({ tempId, folderId }) => {
      addPendingDesign({
        id: tempId,
        name: "Untitled design",
        folderId,
        files: [],
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: ({ tempId, design }, { successMessage }) => {
      confirmPendingDesign(tempId, design);
      openDesignTab(projectId, design.id);
      toast.success(successMessage ?? "Design created");
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingDesign(tempId);
      toast.error(e instanceof Error ? e.message : "Failed to create design");
    },
  });
}
