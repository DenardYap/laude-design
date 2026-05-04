"use client";

import { create } from "zustand";

import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

/**
 * Ephemeral, non-persisted overlay on top of the server-rendered folder/design
 * tree. Its job is to hide the ~300–3000ms latency of `server action →
 * revalidatePath → router.refresh → React re-render` so creating, renaming,
 * and deleting files in the Files tree feels instant — like a real desktop
 * file manager.
 *
 * The flow for every mutation is:
 *   1. `onMutate` writes an optimistic entry here. `project-workspace.tsx`
 *      merges these overlays into the `folders` / `designs` props it passes
 *      down, so every consumer (FilesTree, FolderRow, CommandPalette,
 *      ExportDialog, ScreenshotHost) sees the new state on the next render.
 *   2. `onSuccess` swaps the temporary id for the real server id so stable
 *      keys (open tabs, expanded state, rename affordances) keep working.
 *      The overlay entry stays until step 4 — we only let go once the server
 *      round-trip is visible in props.
 *   3. `onError` removes the optimistic entry and surfaces a toast.
 *   4. Every time new server-rendered props arrive, the consumer calls
 *      `reconcile()` to drop overlays whose state now matches the server
 *      (or whose target item disappeared, making the overlay meaningless).
 *
 * We deliberately use a single module-level store rather than co-located
 * React state because the same item can be mutated in three places (root
 * FilesTree, FolderRow context menu, CanvasPane toolbar), and prop-drilling
 * optimistic state through the tree would be worse than any of the
 * alternatives.
 */

export const PENDING_FOLDER_PREFIX = "temp-folder-";
export const PENDING_DESIGN_PREFIX = "temp-design-";

/** A folder we've asked the server to create but whose id we don't know yet. */
type PendingFolder = FolderDTO;

/** A design we've asked the server to create but whose id we don't know yet. */
type PendingDesign = DesignDTO;

interface OptimisticFilesState {
  pendingFolders: PendingFolder[];
  pendingDesigns: PendingDesign[];
  /** Ids (server or temp) the user has asked to delete — hidden immediately. */
  deletedFolderIds: Set<string>;
  deletedDesignIds: Set<string>;
  /** Instant rename overrides keyed by id (server or temp). */
  folderRenameOverrides: Record<string, string>;
  designRenameOverrides: Record<string, string>;
  /**
   * Instant move overrides. The value is the destination parent/folder id
   * (or `null` for root). Applied on top of server data so dragging a
   * folder into another folder reparents in the same frame, before the
   * server round-trip finishes.
   *
   * `null` is a legal value, so the key being present is what matters —
   * callers must use `in` / `hasOwnProperty` semantics, not truthiness.
   */
  folderParentOverrides: Record<string, string | null>;
  designFolderOverrides: Record<string, string | null>;

  addPendingFolder: (folder: PendingFolder) => void;
  addPendingDesign: (design: PendingDesign) => void;
  /** Swap an optimistic temp id for a real server id once the create resolves. */
  confirmPendingFolder: (tempId: string, real: FolderDTO) => void;
  confirmPendingDesign: (tempId: string, real: DesignDTO) => void;
  /** Drop an optimistic entry after a failed create. */
  dropPendingFolder: (tempId: string) => void;
  dropPendingDesign: (tempId: string) => void;

  markFolderDeleted: (id: string) => void;
  markDesignDeleted: (id: string) => void;
  unmarkFolderDeleted: (id: string) => void;
  unmarkDesignDeleted: (id: string) => void;

  setFolderRename: (id: string, name: string) => void;
  setDesignRename: (id: string, name: string) => void;
  clearFolderRename: (id: string) => void;
  clearDesignRename: (id: string) => void;

  setFolderParent: (id: string, parentId: string | null) => void;
  setDesignFolder: (id: string, folderId: string | null) => void;
  clearFolderParent: (id: string) => void;
  clearDesignFolder: (id: string) => void;

  /**
   * Drop overlays whose state is now visible in the server data (or whose
   * target item has disappeared server-side — e.g. the user renamed, then
   * someone else deleted in another tab). Called whenever fresh props land.
   */
  reconcile: (args: {
    serverFolders: readonly FolderDTO[];
    serverDesigns: readonly DesignDTO[];
  }) => void;
}

export const useOptimisticFilesStore = create<OptimisticFilesState>(
  (set) => ({
    pendingFolders: [],
    pendingDesigns: [],
    deletedFolderIds: new Set(),
    deletedDesignIds: new Set(),
    folderRenameOverrides: {},
    designRenameOverrides: {},
    folderParentOverrides: {},
    designFolderOverrides: {},

    addPendingFolder: (folder) =>
      set((s) => ({ pendingFolders: [...s.pendingFolders, folder] })),
    addPendingDesign: (design) =>
      set((s) => ({ pendingDesigns: [...s.pendingDesigns, design] })),

    confirmPendingFolder: (tempId, real) =>
      set((s) => {
        const next: FolderDTO[] = s.pendingFolders.map((f) =>
          f.id === tempId ? { ...f, ...real } : f,
        );
        // Forward any rename-in-flight keyed on the temp id onto the real id
        // so an eager double-rename (rare but possible) isn't dropped.
        const renameMoved = { ...s.folderRenameOverrides };
        if (renameMoved[tempId] !== undefined) {
          renameMoved[real.id] = renameMoved[tempId];
          delete renameMoved[tempId];
        }
        // Same forwarding for in-flight move overrides (a user could drag
        // the freshly-created folder before the server id lands).
        const parentMoved = { ...s.folderParentOverrides };
        if (tempId in parentMoved) {
          parentMoved[real.id] = parentMoved[tempId];
          delete parentMoved[tempId];
        }
        return {
          pendingFolders: next,
          folderRenameOverrides: renameMoved,
          folderParentOverrides: parentMoved,
        };
      }),
    confirmPendingDesign: (tempId, real) =>
      set((s) => {
        const next = s.pendingDesigns.map((d) =>
          d.id === tempId ? { ...d, ...real } : d,
        );
        const renameMoved = { ...s.designRenameOverrides };
        if (renameMoved[tempId] !== undefined) {
          renameMoved[real.id] = renameMoved[tempId];
          delete renameMoved[tempId];
        }
        const folderMoved = { ...s.designFolderOverrides };
        if (tempId in folderMoved) {
          folderMoved[real.id] = folderMoved[tempId];
          delete folderMoved[tempId];
        }
        return {
          pendingDesigns: next,
          designRenameOverrides: renameMoved,
          designFolderOverrides: folderMoved,
        };
      }),

    dropPendingFolder: (tempId) =>
      set((s) => ({
        pendingFolders: s.pendingFolders.filter((f) => f.id !== tempId),
      })),
    dropPendingDesign: (tempId) =>
      set((s) => ({
        pendingDesigns: s.pendingDesigns.filter((d) => d.id !== tempId),
      })),

    markFolderDeleted: (id) =>
      set((s) => {
        if (s.deletedFolderIds.has(id)) return s;
        const next = new Set(s.deletedFolderIds);
        next.add(id);
        return { deletedFolderIds: next };
      }),
    markDesignDeleted: (id) =>
      set((s) => {
        if (s.deletedDesignIds.has(id)) return s;
        const next = new Set(s.deletedDesignIds);
        next.add(id);
        return { deletedDesignIds: next };
      }),
    unmarkFolderDeleted: (id) =>
      set((s) => {
        if (!s.deletedFolderIds.has(id)) return s;
        const next = new Set(s.deletedFolderIds);
        next.delete(id);
        return { deletedFolderIds: next };
      }),
    unmarkDesignDeleted: (id) =>
      set((s) => {
        if (!s.deletedDesignIds.has(id)) return s;
        const next = new Set(s.deletedDesignIds);
        next.delete(id);
        return { deletedDesignIds: next };
      }),

    setFolderRename: (id, name) =>
      set((s) => ({
        folderRenameOverrides: { ...s.folderRenameOverrides, [id]: name },
      })),
    setDesignRename: (id, name) =>
      set((s) => ({
        designRenameOverrides: { ...s.designRenameOverrides, [id]: name },
      })),
    clearFolderRename: (id) =>
      set((s) => {
        if (s.folderRenameOverrides[id] === undefined) return s;
        const next = { ...s.folderRenameOverrides };
        delete next[id];
        return { folderRenameOverrides: next };
      }),
    clearDesignRename: (id) =>
      set((s) => {
        if (s.designRenameOverrides[id] === undefined) return s;
        const next = { ...s.designRenameOverrides };
        delete next[id];
        return { designRenameOverrides: next };
      }),

    setFolderParent: (id, parentId) =>
      set((s) => ({
        folderParentOverrides: { ...s.folderParentOverrides, [id]: parentId },
      })),
    setDesignFolder: (id, folderId) =>
      set((s) => ({
        designFolderOverrides: { ...s.designFolderOverrides, [id]: folderId },
      })),
    clearFolderParent: (id) =>
      set((s) => {
        if (!(id in s.folderParentOverrides)) return s;
        const next = { ...s.folderParentOverrides };
        delete next[id];
        return { folderParentOverrides: next };
      }),
    clearDesignFolder: (id) =>
      set((s) => {
        if (!(id in s.designFolderOverrides)) return s;
        const next = { ...s.designFolderOverrides };
        delete next[id];
        return { designFolderOverrides: next };
      }),

    reconcile: ({ serverFolders, serverDesigns }) =>
      set((s) => {
        const serverFolderMap = new Map(serverFolders.map((f) => [f.id, f]));
        const serverDesignMap = new Map(serverDesigns.map((d) => [d.id, d]));

        // Drop pending creates whose real id is now present server-side.
        // We only keep temp-prefixed entries (unconfirmed creates) and
        // entries that have been confirmed but haven't yet shown up in the
        // server prop — the latter keep the tree stable during the render
        // gap between `onSuccess` and the next `router.refresh()` tick.
        const nextPendingFolders = s.pendingFolders.filter(
          (f) => !serverFolderMap.has(f.id),
        );
        const nextPendingDesigns = s.pendingDesigns.filter(
          (d) => !serverDesignMap.has(d.id),
        );

        // Drop deletion markers once the server confirms the item is gone.
        // Also drop markers that point at temp ids which never materialised
        // (failed create → user asked to delete the failed temp → cleanup).
        const nextDeletedFolders = new Set<string>();
        for (const id of s.deletedFolderIds) {
          if (serverFolderMap.has(id)) nextDeletedFolders.add(id);
        }
        const nextDeletedDesigns = new Set<string>();
        for (const id of s.deletedDesignIds) {
          if (serverDesignMap.has(id)) nextDeletedDesigns.add(id);
        }

        // Drop rename overrides that match the server's current name, or
        // whose target item no longer exists.
        const nextFolderRenames: Record<string, string> = {};
        for (const [id, name] of Object.entries(s.folderRenameOverrides)) {
          const server = serverFolderMap.get(id);
          if (!server) {
            // Keep override for unconfirmed temp ids; drop orphans.
            if (id.startsWith(PENDING_FOLDER_PREFIX)) {
              nextFolderRenames[id] = name;
            }
            continue;
          }
          if (server.name !== name) nextFolderRenames[id] = name;
        }
        const nextDesignRenames: Record<string, string> = {};
        for (const [id, name] of Object.entries(s.designRenameOverrides)) {
          const server = serverDesignMap.get(id);
          if (!server) {
            if (id.startsWith(PENDING_DESIGN_PREFIX)) {
              nextDesignRenames[id] = name;
            }
            continue;
          }
          if (server.name !== name) nextDesignRenames[id] = name;
        }

        // Drop move overrides whose destination matches the server, whose
        // target no longer exists (unless it's a not-yet-confirmed temp id),
        // or whose destination parent itself has disappeared (e.g. someone
        // deleted the target folder in another tab before the move committed).
        const nextFolderParents: Record<string, string | null> = {};
        for (const [id, parentId] of Object.entries(s.folderParentOverrides)) {
          const server = serverFolderMap.get(id);
          if (!server) {
            if (id.startsWith(PENDING_FOLDER_PREFIX)) {
              nextFolderParents[id] = parentId;
            }
            continue;
          }
          if (parentId !== null && !serverFolderMap.has(parentId)) continue;
          if (server.parentId !== parentId) nextFolderParents[id] = parentId;
        }
        const nextDesignFolders: Record<string, string | null> = {};
        for (const [id, folderId] of Object.entries(s.designFolderOverrides)) {
          const server = serverDesignMap.get(id);
          if (!server) {
            if (id.startsWith(PENDING_DESIGN_PREFIX)) {
              nextDesignFolders[id] = folderId;
            }
            continue;
          }
          if (folderId !== null && !serverFolderMap.has(folderId)) continue;
          if (server.folderId !== folderId) nextDesignFolders[id] = folderId;
        }

        // Avoid re-renders when nothing actually changed.
        const unchanged =
          nextPendingFolders.length === s.pendingFolders.length &&
          nextPendingDesigns.length === s.pendingDesigns.length &&
          nextDeletedFolders.size === s.deletedFolderIds.size &&
          nextDeletedDesigns.size === s.deletedDesignIds.size &&
          shallowEqualRecord(nextFolderRenames, s.folderRenameOverrides) &&
          shallowEqualRecord(nextDesignRenames, s.designRenameOverrides) &&
          shallowEqualNullableRecord(
            nextFolderParents,
            s.folderParentOverrides,
          ) &&
          shallowEqualNullableRecord(
            nextDesignFolders,
            s.designFolderOverrides,
          );
        if (unchanged) return s;

        return {
          pendingFolders: nextPendingFolders,
          pendingDesigns: nextPendingDesigns,
          deletedFolderIds: nextDeletedFolders,
          deletedDesignIds: nextDeletedDesigns,
          folderRenameOverrides: nextFolderRenames,
          designRenameOverrides: nextDesignRenames,
          folderParentOverrides: nextFolderParents,
          designFolderOverrides: nextDesignFolders,
        };
      }),
  }),
);

function shallowEqualRecord(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) if (a[k] !== b[k]) return false;
  return true;
}

function shallowEqualNullableRecord(
  a: Record<string, string | null>,
  b: Record<string, string | null>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/** Build a fresh-looking temp id that's easy to recognise in logs. */
export function nextPendingFolderId(): string {
  return `${PENDING_FOLDER_PREFIX}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
export function nextPendingDesignId(): string {
  return `${PENDING_DESIGN_PREFIX}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Produce the merged folder / design lists the UI should actually render.
 * Given server-rendered data, applies:
 *   - rename overrides
 *   - deletion overrides (items hidden)
 *   - move overrides (parentId / folderId re-parenting)
 *   - pending creates (appended; callers do their own parent-filtering)
 *
 * Pure function so it can be memoised upstream.
 */
export function applyOptimisticOverlays(
  serverFolders: readonly FolderDTO[],
  serverDesigns: readonly DesignDTO[],
  overlay: {
    pendingFolders: readonly FolderDTO[];
    pendingDesigns: readonly DesignDTO[];
    deletedFolderIds: ReadonlySet<string>;
    deletedDesignIds: ReadonlySet<string>;
    folderRenameOverrides: Readonly<Record<string, string>>;
    designRenameOverrides: Readonly<Record<string, string>>;
    folderParentOverrides: Readonly<Record<string, string | null>>;
    designFolderOverrides: Readonly<Record<string, string | null>>;
  },
): { folders: FolderDTO[]; designs: DesignDTO[] } {
  const folders: FolderDTO[] = [];
  for (const f of serverFolders) {
    if (overlay.deletedFolderIds.has(f.id)) continue;
    folders.push(applyFolderOverrides(f, overlay));
  }
  for (const f of overlay.pendingFolders) {
    // Never duplicate a pending entry that's already in server data — can
    // happen for a flicker-frame right after onSuccess swaps the temp id
    // for the real id but before reconcile() fires.
    if (folders.some((existing) => existing.id === f.id)) continue;
    if (overlay.deletedFolderIds.has(f.id)) continue;
    folders.push(applyFolderOverrides(f, overlay));
  }

  const designs: DesignDTO[] = [];
  for (const d of serverDesigns) {
    if (overlay.deletedDesignIds.has(d.id)) continue;
    designs.push(applyDesignOverrides(d, overlay));
  }
  for (const d of overlay.pendingDesigns) {
    if (designs.some((existing) => existing.id === d.id)) continue;
    if (overlay.deletedDesignIds.has(d.id)) continue;
    designs.push(applyDesignOverrides(d, overlay));
  }

  return { folders, designs };
}

function applyFolderOverrides(
  folder: FolderDTO,
  overlay: {
    folderRenameOverrides: Readonly<Record<string, string>>;
    folderParentOverrides: Readonly<Record<string, string | null>>;
  },
): FolderDTO {
  const rename = overlay.folderRenameOverrides[folder.id];
  // `null` is a valid destination (root); use `in` so we don't mistake it
  // for "no override".
  const hasParentOverride = folder.id in overlay.folderParentOverrides;
  if (rename === undefined && !hasParentOverride) return folder;
  return {
    ...folder,
    name: rename !== undefined ? rename : folder.name,
    parentId: hasParentOverride
      ? overlay.folderParentOverrides[folder.id]
      : folder.parentId,
  };
}

function applyDesignOverrides(
  design: DesignDTO,
  overlay: {
    designRenameOverrides: Readonly<Record<string, string>>;
    designFolderOverrides: Readonly<Record<string, string | null>>;
  },
): DesignDTO {
  const rename = overlay.designRenameOverrides[design.id];
  const hasFolderOverride = design.id in overlay.designFolderOverrides;
  if (rename === undefined && !hasFolderOverride) return design;
  return {
    ...design,
    name: rename !== undefined ? rename : design.name,
    folderId: hasFolderOverride
      ? overlay.designFolderOverrides[design.id]
      : design.folderId,
  };
}
