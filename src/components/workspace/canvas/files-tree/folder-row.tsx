"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import {
  ChevronDown,
  ChevronRight,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { nextPendingDesignId, nextPendingFolderId } from "@/stores/optimistic-files-store";
import { useCreateFolder } from "@/components/workspace/canvas/hooks/use-create-folder";
import { useCreateDesign } from "@/components/workspace/canvas/hooks/use-create-design";
import {
  useRenameFolder,
  useDeleteFolder,
  useMoveFolder,
} from "@/components/workspace/canvas/hooks/use-folder-mutations";
import { useDropIntoFolder } from "@/components/workspace/canvas/hooks/use-drop-into-folder";

import { FolderChildren } from "./folder-children";
import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import { buildDeleteDescription, collectDescendants } from "./utils";
import type { FolderRowProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

export function FolderRow({ projectId, folder, folders, designs, depth }: FolderRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const renameTriggeredRef = useRef(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const descendants = useMemo(
    () => collectDescendants(folder.id, folders, designs),
    [folder.id, folders, designs],
  );

  const newSubFolder = useCreateFolder(projectId);
  const newSubDesign = useCreateDesign(projectId);
  const rename = useRenameFolder(folder, { onBeforeCommit: () => setRenaming(false) });
  const remove = useDeleteFolder(folder);
  const moveFolderMutation = useMoveFolder();
  const dropIntoFolder = useDropIntoFolder({
    targetFolderId: folder.id,
    targetFolderName: folder.name,
    folders,
    designs,
  });

  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  function bumpDropHighlight() {
    setDropTarget(true);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setDropTarget(false), 120);
  }

  function handleDrop(e: DragEvent) {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setDropTarget(false);
    dropIntoFolder(e);
  }

  function handleDeleteSelect() {
    if (descendants.designCount > 0 || descendants.folderCount > 0) {
      setConfirmOpen(true);
    } else {
      remove.mutate();
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // "move" cursor instead of the default "copy" → no green + badge.
        e.dataTransfer.dropEffect = "move";
        bumpDropHighlight();
      }}
      onDrop={handleDrop}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            draggable={!renaming}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", `folder:${folder.id}`);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => !renaming && setExpanded((v) => !v)}
            onDoubleClick={() => setRenaming(true)}
            className={cn(
              "group flex w-full cursor-pointer items-center gap-1 rounded-md pr-1.5 py-1 text-sm text-ink transition-colors",
              "hover:bg-surface-sunken/60",
              dropTarget &&
                "bg-surface-sunken ring-1 ring-border-strong hover:bg-surface-sunken",
            )}
            style={{ paddingLeft: `calc(${depth * 12}px + 0.375rem)` }}
          >
            {expanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-ink-muted" />
            )}
            {expanded ? (
              <FolderOpen className="size-3.5 shrink-0 text-ink-muted" />
            ) : (
              <FolderClosed className="size-3.5 shrink-0 text-ink-muted" />
            )}
            {renaming ? (
              <InlineRenameInput
                initialValue={folder.name}
                onCommit={(v) => {
                  const trimmed = v.trim().slice(0, 80) || "Untitled";
                  if (trimmed === folder.name) {
                    setRenaming(false);
                    return;
                  }
                  const siblingNames = [
                    ...folders.filter((f) => f.id !== folder.id && f.parentId === folder.parentId),
                    ...designs.filter((d) => d.folderId === folder.parentId),
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
              <span className="flex-1 truncate">{folder.name}</span>
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
          <ContextMenuItem
            onSelect={() =>
              newSubFolder.mutate({
                tempId: nextPendingFolderId(),
                parentId: folder.id,
                successMessage: `Folder created in "${folder.name}"`,
              })
            }
          >
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              newSubDesign.mutate({
                tempId: nextPendingDesignId(),
                folderId: folder.id,
                successMessage: `Design created in "${folder.name}"`,
              })
            }
          >
            <Plus className="size-3.5" />
            New design
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              renameTriggeredRef.current = true;
              setRenaming(true);
            }}
          >
            Rename
          </ContextMenuItem>
          {folder.parentId !== null && (
            <ContextMenuItem
              onSelect={() =>
                moveFolderMutation.mutate({
                  folderId: folder.id,
                  targetParentId: null,
                  folderName: folder.name,
                })
              }
            >
              Move to root
            </ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={handleDeleteSelect}
          >
            Delete folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded ? (
        <>
          <FolderChildren
            projectId={projectId}
            parentId={folder.id}
            folders={folders}
            designs={designs}
            depth={depth + 1}
          />
          <div style={{ height: 6 }} />
        </>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${folder.name}"?`}
        description={buildDeleteDescription(folder.name, descendants)}
        confirmLabel="Delete folder"
        tone="destructive"
        onConfirm={async () => {
          await remove.mutateAsync();
        }}
      />
    </div>
  );
}

