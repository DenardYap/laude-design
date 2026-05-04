"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
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
import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import {
  nextPendingDesignId,
  nextPendingFolderId,
  useOptimisticFilesStore,
} from "@/stores/optimistic-files-store";
import {
  createFolder,
  deleteFolder,
  moveFolder,
  renameFolder,
} from "@/server/actions/folders";
import { createDesign, moveDesign } from "@/server/actions/designs";

import { FolderChildren } from "./folder-children";
import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import { collectDescendants, isDescendantOf } from "./utils";
import type { FolderRowProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

export function FolderRow({ projectId, folder, folders, designs, depth }: FolderRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const renameTriggeredRef = useRef(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Whether this folder is "non-empty" — used to decide if delete needs a
  // forcing-function (Norman: lock-in for irreversible actions).
  const descendants = useMemo(
    () => collectDescendants(folder.id, folders, designs),
    [folder.id, folders, designs],
  );

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
  const setFolderRename = useOptimisticFilesStore((s) => s.setFolderRename);
  const clearFolderRename = useOptimisticFilesStore(
    (s) => s.clearFolderRename,
  );
  const markFolderDeleted = useOptimisticFilesStore(
    (s) => s.markFolderDeleted,
  );
  const unmarkFolderDeleted = useOptimisticFilesStore(
    (s) => s.unmarkFolderDeleted,
  );
  const setFolderParent = useOptimisticFilesStore((s) => s.setFolderParent);
  const clearFolderParent = useOptimisticFilesStore(
    (s) => s.clearFolderParent,
  );
  const setDesignFolder = useOptimisticFilesStore((s) => s.setDesignFolder);
  const clearDesignFolder = useOptimisticFilesStore(
    (s) => s.clearDesignFolder,
  );

  const newSubFolder = useMutation({
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const result = await createFolder(projectId, "New folder", folder.id);
      return { tempId, folder: result };
    },
    onMutate: ({ tempId }) => {
      addPendingFolder({
        id: tempId,
        name: "New folder",
        parentId: folder.id,
      });
    },
    onSuccess: ({ tempId, folder: realFolder }) => {
      confirmPendingFolder(tempId, realFolder);
      toast.success(`Folder created in “${folder.name}”`);
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingFolder(tempId);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });
  const newSubDesign = useMutation({
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const design = await createDesign(projectId, {
        name: "Untitled design",
        folderId: folder.id,
      });
      return { tempId, design };
    },
    onMutate: ({ tempId }) => {
      addPendingDesign({
        id: tempId,
        name: "Untitled design",
        folderId: folder.id,
        files: [],
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: ({ tempId, design }) => {
      confirmPendingDesign(tempId, design);
      toast.success(`Design created in “${folder.name}”`);
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingDesign(tempId);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });
  const move = useMutation({
    mutationFn: async () => {
      await moveFolder(folder.id, null);
    },
    onMutate: () => {
      setFolderParent(folder.id, null);
    },
    onSuccess: () => {
      toast.success(`Moved "${folder.name}" to root`);
      router.refresh();
    },
    onError: (e) => {
      clearFolderParent(folder.id);
      toast.error(e instanceof Error ? e.message : "Move failed");
    },
  });
  const rename = useMutation({
    mutationFn: async (n: string) => {
      const next = n.trim().slice(0, 80) || "Untitled";
      await renameFolder(folder.id, next);
      return next;
    },
    onMutate: (n) => {
      // Optimistic rename: show the new label the moment the user commits.
      const next = n.trim().slice(0, 80) || "Untitled";
      setFolderRename(folder.id, next);
      setRenaming(false);
    },
    onSuccess: (newName) => {
      toast.success(`Renamed folder to “${newName}”`);
      router.refresh();
    },
    onError: (e) => {
      clearFolderRename(folder.id);
      toast.error(e instanceof Error ? e.message : "Rename failed");
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      await deleteFolder(folder.id);
      return folder.name;
    },
    onMutate: () => {
      // Hide the folder (and, transitively, its children via server
      // filtering on next refresh) as soon as the user confirms.
      markFolderDeleted(folder.id);
    },
    onSuccess: (name) => {
      toast.success(`Deleted “${name}”`);
      router.refresh();
    },
    onError: (e) => {
      unmarkFolderDeleted(folder.id);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    },
  });

  // Drop-target state is driven by a debounced timeout. While the cursor is
  // over us (or any child element that doesn't intercept), dragOver fires
  // continuously and refreshes the timeout; once events stop (cursor moves
  // into a deeper nested wrapper that calls stopPropagation, or leaves
  // entirely), the timeout fires and clears the highlight. This avoids the
  // "parent stays highlighted while a nested folder is the real target"
  // problem that any naive enter/leave counter has.
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

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setDropTarget(false);

    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [kind, id] = data.split(":");

    if (kind === "design") {
      // Optimistic move: the tree reparents in the next frame; if the server
      // rejects (e.g. design was deleted in another tab), revert + toast.
      const design = designs.find((d) => d.id === id);
      setDesignFolder(id, folder.id);
      try {
        await moveDesign(id, folder.id);
        if (design) toast.success(`Moved "${design.name}" to "${folder.name}"`);
        router.refresh();
      } catch (err) {
        clearDesignFolder(id);
        toast.error(err instanceof Error ? err.message : "Move failed");
      }
      return;
    }

    if (kind === "folder" && id !== folder.id) {
      // Cycle guard: never optimistically drop a folder into one of its own
      // descendants. The server rejects this anyway, but applying it first
      // would produce an orphan-looking subtree for a few hundred ms.
      if (isDescendantOf(folder.id, id, folders)) {
        toast.error("Can't move a folder into itself");
        return;
      }
      const moved = folders.find((f) => f.id === id);
      setFolderParent(id, folder.id);
      try {
        await moveFolder(id, folder.id);
        if (moved) toast.success(`Moved "${moved.name}" to "${folder.name}"`);
        router.refresh();
      } catch (err) {
        clearFolderParent(id);
        toast.error(err instanceof Error ? err.message : "Move failed");
      }
    }
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
      // Wrapper covers the header AND the expanded children area, so a drop
      // anywhere "under" this folder (not just on its 24px-tall header strip)
      // is treated as moving into this folder. stopPropagation in the inner
      // handlers ensures only the deepest nested folder claims the drop.
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
              newSubFolder.mutate({ tempId: nextPendingFolderId() })
            }
          >
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              newSubDesign.mutate({ tempId: nextPendingDesignId() })
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
            <ContextMenuItem onSelect={() => move.mutate()}>
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
          {/* Catchment strip: inside this folder's drop boundary but below all
              children, so drags to the bottom of the folder's region still
              route here rather than to a sibling or ancestor. */}
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

function buildDeleteDescription(
  name: string,
  { designCount, folderCount }: ReturnType<typeof collectDescendants>,
): string {
  const parts: string[] = [];
  if (designCount > 0) {
    parts.push(`${designCount} ${designCount === 1 ? "file" : "files"}`);
  }
  if (folderCount > 0) {
    parts.push(`${folderCount} ${folderCount === 1 ? "subfolder" : "subfolders"}`);
  }
  // Joiner: ["3 files"] → "3 files"; ["3 files","2 subfolders"] → "3 files and 2 subfolders"
  const inside = parts.length === 0 ? "" : parts.length === 1 ? parts[0] : parts.join(" and ");
  if (!inside) {
    return `“${name}” will be permanently deleted. This cannot be undone.`;
  }
  return `This will permanently delete ${inside} in “${name}”. Are you sure?`;
}
