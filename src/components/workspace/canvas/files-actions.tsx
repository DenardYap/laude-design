"use client";

import { FolderPlus, Plus } from "lucide-react";

import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  nextPendingDesignId,
  nextPendingFolderId,
} from "@/stores/optimistic-files-store";
import { useCreateFolder } from "@/components/workspace/canvas/hooks/use-create-folder";
import { useCreateDesign } from "@/components/workspace/canvas/hooks/use-create-design";
import type { FilesActionsProps } from "@/components/workspace/canvas/types/misc";

export function FilesActions({ projectId }: FilesActionsProps) {
  const newFolder = useCreateFolder(projectId);
  const newDesign = useCreateDesign(projectId);

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New folder"
            className="size-7"
            icon={<FolderPlus className="size-3.5" />}
            onClick={() => newFolder.mutate({ tempId: nextPendingFolderId(), parentId: null })}
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
            onClick={() => newDesign.mutate({ tempId: nextPendingDesignId(), folderId: null })}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New design</TooltipContent>
      </Tooltip>
    </div>
  );
}
