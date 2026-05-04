"use client";

import { useRef, useState } from 'react';
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
import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { deleteDesign, moveDesign, renameDesign } from "@/server/actions/designs";

import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import type { DesignRowProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

export function DesignRow({ projectId, design, folders, designs, depth }: DesignRowProps) {
  const router = useRouter();
  const openTab = useWorkspaceStore((s) => s.openDesignTab);
  const setDesignRename = useOptimisticFilesStore((s) => s.setDesignRename);
  const clearDesignRename = useOptimisticFilesStore(
    (s) => s.clearDesignRename,
  );
  const markDesignDeleted = useOptimisticFilesStore(
    (s) => s.markDesignDeleted,
  );
  const unmarkDesignDeleted = useOptimisticFilesStore(
    (s) => s.unmarkDesignDeleted,
  );
  const setDesignFolder = useOptimisticFilesStore((s) => s.setDesignFolder);
  const clearDesignFolder = useOptimisticFilesStore(
    (s) => s.clearDesignFolder,
  );
  const [renaming, setRenaming] = useState(false);
  const renameTriggeredRef = useRef(false);

  const rename = useMutation({
    mutationFn: async (n: string) => {
      const next = n.trim() || "Untitled";
      await renameDesign(design.id, n);
      return next;
    },
    onMutate: (n) => {
      const next = n.trim() || "Untitled";
      setDesignRename(design.id, next);
      setRenaming(false);
    },
    onSuccess: (newName) => {
      toast.success(`Renamed design to “${newName}”`);
      router.refresh();
    },
    onError: (e) => {
      clearDesignRename(design.id);
      toast.error(e instanceof Error ? e.message : "Rename failed");
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      await deleteDesign(design.id);
      return design.name;
    },
    onMutate: () => {
      markDesignDeleted(design.id);
    },
    onSuccess: (name) => {
      toast.success(`Deleted “${name}”`);
      router.refresh();
    },
    onError: (e) => {
      unmarkDesignDeleted(design.id);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    },
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
              onCommit={(v) => {
                const trimmed = v.trim().slice(0, 80) || "Untitled design";
                if (trimmed === design.name) {
                  setRenaming(false);
                  return;
                }
                const siblingNames = [
                  ...folders.filter((f) => f.parentId === design.folderId),
                  ...designs.filter((d) => d.id !== design.id && d.folderId === design.folderId),
                ].map((x) => x.name.toLowerCase());
                if (siblingNames.includes(trimmed.toLowerCase())) {
                  toast.error(`"${trimmed}" already exists in this folder`);
                  setRenaming(false);
                  return;
                }
                rename.mutate(v);
              }}
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
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          if (renameTriggeredRef.current) {
            e.preventDefault();
            renameTriggeredRef.current = false;
          }
        }}
      >
        <ContextMenuItem onSelect={() => openTab(projectId, design.id)}>Open</ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            renameTriggeredRef.current = true;
            setRenaming(true);
          }}
        >
          Rename
        </ContextMenuItem>
        {folders.length > 0 && design.folderId !== null ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={async () => {
                setDesignFolder(design.id, null);
                try {
                  await moveDesign(design.id, null);
                  router.refresh();
                } catch (err) {
                  clearDesignFolder(design.id);
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
