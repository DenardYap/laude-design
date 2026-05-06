"use client";

import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { FolderPlus, Plus } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui";
import { nextPendingDesignId, nextPendingFolderId } from "@/stores/optimistic-files-store";
import { useCreateFolder } from "@/components/workspace/canvas/hooks/use-create-folder";
import { useCreateDesign } from "@/components/workspace/canvas/hooks/use-create-design";
import { useDropIntoFolder } from "@/components/workspace/canvas/hooks/use-drop-into-folder";

import { FolderChildren } from "./folder-children";
import { ProjectRootRow } from "@/components/workspace/canvas/files-tree/project-root-row";
import { RootEmptyState } from "@/components/workspace/canvas/files-tree/root-empty-state";
import type { FilesTreeProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

/**
 *   ▾ 📂 Project Name   
 *      │
 *      ├─ 📁 Folder
 *      │   └─ 📄 Design
 *      └─ 📄 Design
 */
export function FilesTree({
  projectId,
  projectName,
  folders,
  designs,
}: FilesTreeProps) {
  const newFolder = useCreateFolder(projectId);
  const newDesign = useCreateDesign(projectId);
  const dropIntoRoot = useDropIntoFolder({ targetFolderId: null, folders, designs });
  const [rootExpanded, setRootExpanded] = useState(true);
  const [rootDropTarget, setRootDropTarget] = useState(false);

  const rootClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (rootClearTimer.current) clearTimeout(rootClearTimer.current);
    };
  }, []);

  function bumpRootDropHighlight() {
    setRootDropTarget(true);
    if (rootClearTimer.current) clearTimeout(rootClearTimer.current);
    rootClearTimer.current = setTimeout(() => setRootDropTarget(false), 120);
  }

  function handleRootDrop(e: DragEvent) {
    if (rootClearTimer.current) clearTimeout(rootClearTimer.current);
    setRootDropTarget(false);
    dropIntoRoot(e);
  }

  const isEmpty = folders.length === 0 && designs.length === 0;

  return (
    <div className="flex h-full flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 space-y-0.5 overflow-y-auto p-2"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              bumpRootDropHighlight();
            }}
            onDrop={handleRootDrop}
          >
            <ProjectRootRow
              name={projectName}
              expanded={rootExpanded}
              onToggle={() => setRootExpanded((v) => !v)}
              dropTarget={rootDropTarget}
            />

            {rootExpanded ? (
              isEmpty ? (
                <RootEmptyState />
              ) : (
                <>
                  <FolderChildren
                    projectId={projectId}
                    parentId={null}
                    folders={folders}
                    designs={designs}
                    depth={1}
                  />
                  <div style={{ height: 6 }} />
                </>
              )
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => newFolder.mutate({ tempId: nextPendingFolderId(), parentId: null })}
          >
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => newDesign.mutate({ tempId: nextPendingDesignId(), folderId: null })}
          >
            <Plus className="size-3.5" />
            New design
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

