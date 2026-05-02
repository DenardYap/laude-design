"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { File as FileIcon } from "lucide-react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui";
import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { deleteDesign, moveDesign, renameDesign } from "@/server/actions/designs";

import { InlineRenameInput } from "./inline-rename-input";

interface DesignRowProps {
  projectId: string;
  design: DesignDTO;
  folders: FolderDTO[];
  depth: number;
}

export function DesignRow({ projectId, design, folders, depth }: DesignRowProps) {
  const router = useRouter();
  const openTab = useWorkspaceStore((s) => s.openDesignTab);
  const [renaming, setRenaming] = React.useState(false);

  const rename = useMutation({
    mutationFn: (n: string) => renameDesign(design.id, n),
    onSuccess: () => {
      setRenaming(false);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Rename failed"),
  });
  const remove = useMutation({
    mutationFn: () => deleteDesign(design.id),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable={!renaming}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", `design:${design.id}`);
            // "move" cursor + dropEffect on targets → no green "+" badge.
            e.dataTransfer.effectAllowed = "move";
          }}
          onDoubleClick={() => !renaming && openTab(projectId, design.id)}
          className="group flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-sm text-ink hover:bg-surface-sunken/60"
          // marginLeft (outside the chip) instead of paddingLeft (inside),
          // so the hover background hugs the icon + name and the depth
          // indent doesn't paint into the chip. +18 vs FolderRow's 0 lines
          // the file icon up under the folder icon (skipping chevron+gap).
          style={{ marginLeft: depth * 12 + 18 }}
        >
          <FileIcon className="size-3.5 shrink-0 text-ink-muted" />
          {renaming ? (
            <InlineRenameInput
              initialValue={design.name}
              onCommit={(v) => rename.mutate(v)}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <button
              type="button"
              className="flex-1 truncate text-left"
              onClick={() => openTab(projectId, design.id)}
            >
              {design.name}
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => openTab(projectId, design.id)}>Open</ContextMenuItem>
        <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
        {folders.length > 0 && design.folderId !== null ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={async () => {
                try {
                  await moveDesign(design.id, null);
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Move failed");
                }
              }}
            >
              Move to root
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => remove.mutate()}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
