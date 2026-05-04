"use client";

import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

import { DesignRow } from "./design-row";
import { FolderRow } from "./folder-row";

interface FolderChildrenProps {
  projectId: string;
  parentId: string | null;
  folders: FolderDTO[];
  designs: DesignDTO[];
  depth: number;
}

/**
 * Renders the direct children of a folder. Pulled out of FolderRow so the
 * recursion is explicit and the two row components don't have to import each
 * other.
 *
 * At depth ≥ 1 we draw a vertical guide line (à la VS Code's file explorer)
 * at the parent folder's chevron column. The line connects siblings under a
 * common parent so the hierarchy is obvious at a glance.
 *
 * Geometry: a row at depth N has `marginLeft: N * 12`, then a 6px chip
 * padding (`px-1.5`) + 14px chevron whose center sits 7px in. So the parent's
 * chevron center — and therefore the guide line for that parent's children —
 * is at `(depth - 1) * 12 + 13` from the children container's left edge.
 */
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
