import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import type { DescendantCounts } from "@/components/workspace/canvas/files-tree/types/files-tree";

export type { DescendantCounts };

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
 * Builds a human-readable delete-confirmation description that calls out the
 * exact blast radius ("3 files and 2 subfolders") so users see what they're
 * about to destroy before they confirm.
 */
export function buildDeleteDescription(
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
  const inside = parts.length === 0 ? "" : parts.length === 1 ? parts[0] : parts.join(" and ");
  if (!inside) {
    return `"${name}" will be permanently deleted. This cannot be undone.`;
  }
  return `This will permanently delete ${inside} in "${name}". Are you sure?`;
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
