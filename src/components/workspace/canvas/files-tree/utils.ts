import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

export interface DescendantCounts {
  designCount: number;
  folderCount: number;
}

/**
 * Walk a folder's subtree and count every nested folder + design. Used to
 * power the delete-confirmation copy ("This will delete X file(s) and Y
 * subfolder(s)") so users see the real blast radius before they confirm.
 */
export function collectDescendants(
  rootId: string,
  folders: FolderDTO[],
  designs: DesignDTO[],
): DescendantCounts {
  const folderIds = new Set<string>([rootId]);

  // BFS — keep adding any folder whose parent is already in the set until
  // there's nothing new to add.
  let added = true;
  while (added) {
    added = false;
    for (const f of folders) {
      if (f.parentId && folderIds.has(f.parentId) && !folderIds.has(f.id)) {
        folderIds.add(f.id);
        added = true;
      }
    }
  }

  folderIds.delete(rootId); // root itself is not a descendant
  const designCount = designs.filter(
    (d) => d.folderId !== null && (d.folderId === rootId || folderIds.has(d.folderId)),
  ).length;

  return { designCount, folderCount: folderIds.size };
}

/**
 * Returns true if `candidateId` is in the ancestor chain of `folderId`
 * (i.e. moving `candidateId` into `folderId` would create a cycle).
 * Walks parent pointers upwards with a visited guard to stop on the rare
 * case of an already-corrupted tree.
 */
export function isDescendantOf(
  folderId: string,
  candidateId: string,
  folders: readonly FolderDTO[],
): boolean {
  if (folderId === candidateId) return true;
  const byId = new Map(folders.map((f) => [f.id, f]));
  const seen = new Set<string>();
  let cursor: string | null = folderId;
  while (cursor) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    if (cursor === candidateId) return true;
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}
