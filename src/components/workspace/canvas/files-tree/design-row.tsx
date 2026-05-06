"use client";

import { useRef, useState } from 'react';
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
import { useRenameDesign, useDeleteDesign, useMoveDesign } from "@/components/workspace/canvas/hooks/use-design-mutations";

import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import type { DesignRowProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

export function DesignRow({ projectId, design, folders, designs, depth }: DesignRowProps) {
  const openTab = useWorkspaceStore((s) => s.openDesignTab);
  const [renaming, setRenaming] = useState(false);
  const renameTriggeredRef = useRef(false);

  const rename = useRenameDesign(design, { onBeforeCommit: () => setRenaming(false) });
  const remove = useDeleteDesign(design);
  const moveDesign = useMoveDesign();

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
              onSelect={() =>
                moveDesign.mutate({
                  designId: design.id,
                  targetFolderId: null,
                  designName: design.name,
                })
              }
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
