"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  nextPendingDesignId,
  nextPendingFolderId,
  useOptimisticFilesStore,
} from "@/stores/optimistic-files-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { createFolder } from "@/server/actions/folders";
import { createDesign } from "@/server/actions/designs";

export function FilesActions({ projectId }: { projectId: string }) {
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

  const newFolder = useMutation({
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const folder = await createFolder(projectId, "New folder", null);
      return { tempId, folder };
    },
    onMutate: ({ tempId }) => {
      addPendingFolder({ id: tempId, name: "New folder", parentId: null });
    },
    onSuccess: ({ tempId, folder }) => {
      confirmPendingFolder(tempId, folder);
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

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New folder"
            className="size-7"
            icon={<FolderPlus className="size-3.5" />}
            onClick={() =>
              newFolder.mutate({ tempId: nextPendingFolderId() })
            }
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New folder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New design"
            className="size-7"
            icon={<Plus className="size-3.5" />}
            onClick={() =>
              newDesign.mutate({ tempId: nextPendingDesignId() })
            }
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New design</TooltipContent>
      </Tooltip>
    </div>
  );
}
