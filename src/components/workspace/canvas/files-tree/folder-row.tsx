"use client";

import * as React from "react";
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
  createFolder,
  deleteFolder,
  moveFolder,
  renameFolder,
} from "@/server/actions/folders";
import { createDesign, moveDesign } from "@/server/actions/designs";

import { FolderChildren } from "./folder-children";
import { InlineRenameInput } from "./inline-rename-input";
import { collectDescendants } from "./utils";

interface FolderRowProps {
  projectId: string;
  folder: FolderDTO;
  folders: FolderDTO[];
  designs: DesignDTO[];
  depth: number;
}

export function FolderRow({ projectId, folder, folders, designs, depth }: FolderRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(true);
  const [renaming, setRenaming] = React.useState(false);
  const [dropTarget, setDropTarget] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Whether this folder is "non-empty" — used to decide if delete needs a
  // forcing-function (Norman: lock-in for irreversible actions).
  const descendants = React.useMemo(
    () => collectDescendants(folder.id, folders, designs),
    [folder.id, folders, designs],
  );

  const newSubFolder = useMutation({
    mutationFn: () => createFolder(projectId, "New folder", folder.id),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const newSubDesign = useMutation({
    mutationFn: () => createDesign(projectId, { name: "Untitled design", folderId: folder.id }),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rename = useMutation({
    mutationFn: (n: string) => renameFolder(folder.id, n),
    onSuccess: () => {
      setRenaming(false);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Rename failed"),
  });
  const remove = useMutation({
    mutationFn: () => deleteFolder(folder.id),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  // Drop-target state is driven by a debounced timeout. While the cursor is
  // over us (or any child element that doesn't intercept), dragOver fires
  // continuously and refreshes the timeout; once events stop (cursor moves
  // into a deeper nested wrapper that calls stopPropagation, or leaves
  // entirely), the timeout fires and clears the highlight. This avoids the
  // "parent stays highlighted while a nested folder is the real target"
  // problem that any naive enter/leave counter has.
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  function bumpDropHighlight() {
    setDropTarget(true);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setDropTarget(false), 120);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setDropTarget(false);

    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [kind, id] = data.split(":");
    try {
      if (kind === "design") {
        await moveDesign(id, folder.id);
      } else if (kind === "folder" && id !== folder.id) {
        await moveFolder(id, folder.id);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
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
              // `w-fit max-w-full` makes the chip hug its content (icon + name)
              // instead of stretching to the parent width, so the drop / hover
              // / rename affordances all read as a contained pill rather than
              // a full-bleed bar.
              "group flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-sm text-ink transition-colors",
              "hover:bg-surface-sunken/60",
              // Use the same neutral "selected" treatment context-menu /
              // dropdown items use (bg-surface-sunken) instead of the warm
              // brand cream — keeps drag-drop feedback feeling like a system
              // selection state, not a brand accent.
              dropTarget &&
                "bg-surface-sunken ring-1 ring-border-strong hover:bg-surface-sunken",
            )}
            style={{ marginLeft: depth * 12 }}
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
                onCommit={(v) => rename.mutate(v)}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <span className="flex-1 truncate">{folder.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => newSubFolder.mutate()}>
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => newSubDesign.mutate()}>
            <Plus className="size-3.5" />
            New design
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setRenaming(true)}>Rename</ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={handleDeleteSelect}
          >
            Delete folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded ? (
        <FolderChildren
          projectId={projectId}
          parentId={folder.id}
          folders={folders}
          designs={designs}
          depth={depth + 1}
        />
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
