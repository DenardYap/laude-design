"use client";

import { DesignRow } from "./design-row";
import { FolderRow } from "./folder-row";
import type { FolderChildrenProps } from "@/components/workspace/canvas/files-tree/types/files-tree";

export function FolderChildren({
  projectId,
  parentId,
  folders,
  designs,
  depth,
}: FolderChildrenProps) {
  const childFolders = folders.filter((f) => f.parentId === parentId);
  const childDesigns = designs.filter((d) => d.folderId === parentId);

  if (childFolders.length === 0 && childDesigns.length === 0) {
    return null;
  }

  return (
    <div className="relative space-y-0.5">
      {depth >= 1 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 top-0 w-px bg-border-strong/60"
          style={{ left: (depth - 1) * 12 + 13 }}
        />
      ) : null}
      {childFolders.map((f) => (
        <FolderRow
          key={f.id}
          projectId={projectId}
          folder={f}
          folders={folders}
          designs={designs}
          depth={depth}
        />
      ))}
      {childDesigns.map((d) => (
        <DesignRow
          key={d.id}
          projectId={projectId}
          design={d}
          folders={folders}
          designs={designs}
          depth={depth}
        />
      ))}
    </div>
  );
}
