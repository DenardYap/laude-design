import { beforeEach, describe, expect, it } from "vitest";

import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

import {
  applyOptimisticOverlays,
  nextPendingDesignId,
  nextPendingFolderId,
  PENDING_DESIGN_PREFIX,
  PENDING_FOLDER_PREFIX,
  useOptimisticFilesStore,
} from "./optimistic-files-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFolder(overrides?: Partial<FolderDTO>): FolderDTO {
  return { id: "folder-1", name: "Alpha", parentId: null, ...overrides };
}

function makeDesign(overrides?: Partial<DesignDTO>): DesignDTO {
  return {
    id: "design-1",
    name: "Home",
    folderId: null,
    files: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function resetStore() {
  useOptimisticFilesStore.setState({
    pendingFolders: [],
    pendingDesigns: [],
    deletedFolderIds: new Set(),
    deletedDesignIds: new Set(),
    folderRenameOverrides: {},
    designRenameOverrides: {},
    folderParentOverrides: {},
    designFolderOverrides: {},
  });
}

beforeEach(resetStore);

// ---------------------------------------------------------------------------
// nextPendingFolderId / nextPendingDesignId
// ---------------------------------------------------------------------------

describe("nextPendingFolderId / nextPendingDesignId", () => {
  it("returns a string prefixed with PENDING_FOLDER_PREFIX", () => {
    expect(nextPendingFolderId().startsWith(PENDING_FOLDER_PREFIX)).toBe(true);
  });

  it("returns a string prefixed with PENDING_DESIGN_PREFIX", () => {
    expect(nextPendingDesignId().startsWith(PENDING_DESIGN_PREFIX)).toBe(true);
  });

  it("generates unique folder ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, nextPendingFolderId));
    expect(ids.size).toBe(50);
  });

  it("generates unique design ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, nextPendingDesignId));
    expect(ids.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// addPendingFolder / addPendingDesign
// ---------------------------------------------------------------------------

describe("addPendingFolder", () => {
  it("appends the folder to pendingFolders", () => {
    const f = makeFolder({ id: nextPendingFolderId() });
    useOptimisticFilesStore.getState().addPendingFolder(f);
    expect(useOptimisticFilesStore.getState().pendingFolders).toContainEqual(f);
  });

  it("accumulates multiple calls", () => {
    const a = makeFolder({ id: nextPendingFolderId(), name: "A" });
    const b = makeFolder({ id: nextPendingFolderId(), name: "B" });
    useOptimisticFilesStore.getState().addPendingFolder(a);
    useOptimisticFilesStore.getState().addPendingFolder(b);
    expect(useOptimisticFilesStore.getState().pendingFolders).toHaveLength(2);
  });
});

describe("addPendingDesign", () => {
  it("appends the design to pendingDesigns", () => {
    const d = makeDesign({ id: nextPendingDesignId() });
    useOptimisticFilesStore.getState().addPendingDesign(d);
    expect(useOptimisticFilesStore.getState().pendingDesigns).toContainEqual(d);
  });
});

// ---------------------------------------------------------------------------
// confirmPendingFolder / confirmPendingDesign
// ---------------------------------------------------------------------------

describe("confirmPendingFolder", () => {
  it("replaces the temp entry with real server data", () => {
    const tempId = nextPendingFolderId();
    const temp = makeFolder({ id: tempId, name: "Temp" });
    const real = makeFolder({ id: "real-folder-1", name: "Temp" });
    useOptimisticFilesStore.getState().addPendingFolder(temp);
    useOptimisticFilesStore.getState().confirmPendingFolder(tempId, real);
    const { pendingFolders } = useOptimisticFilesStore.getState();
    expect(pendingFolders.some((f) => f.id === tempId)).toBe(false);
    expect(pendingFolders.some((f) => f.id === real.id)).toBe(true);
  });

  it("forwards an in-flight rename override from temp id to real id", () => {
    const tempId = nextPendingFolderId();
    useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
    useOptimisticFilesStore.getState().setFolderRename(tempId, "Renamed");
    useOptimisticFilesStore
      .getState()
      .confirmPendingFolder(tempId, makeFolder({ id: "real-folder-1" }));
    const { folderRenameOverrides } = useOptimisticFilesStore.getState();
    expect(folderRenameOverrides[tempId]).toBeUndefined();
    expect(folderRenameOverrides["real-folder-1"]).toBe("Renamed");
  });

  it("forwards an in-flight parent override from temp id to real id", () => {
    const tempId = nextPendingFolderId();
    useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
    useOptimisticFilesStore.getState().setFolderParent(tempId, "parent-folder");
    useOptimisticFilesStore
      .getState()
      .confirmPendingFolder(tempId, makeFolder({ id: "real-folder-1" }));
    const { folderParentOverrides } = useOptimisticFilesStore.getState();
    expect(tempId in folderParentOverrides).toBe(false);
    expect(folderParentOverrides["real-folder-1"]).toBe("parent-folder");
  });

  it("does not disturb unrelated pending entries", () => {
    const tempA = nextPendingFolderId();
    const tempB = nextPendingFolderId();
    useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempA }));
    useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempB }));
    useOptimisticFilesStore
      .getState()
      .confirmPendingFolder(tempA, makeFolder({ id: "real-folder-1" }));
    expect(
      useOptimisticFilesStore.getState().pendingFolders.some((f) => f.id === tempB),
    ).toBe(true);
  });
});

describe("confirmPendingDesign", () => {
  it("replaces the temp entry with real server data", () => {
    const tempId = nextPendingDesignId();
    useOptimisticFilesStore.getState().addPendingDesign(makeDesign({ id: tempId }));
    const real = makeDesign({ id: "real-design-1" });
    useOptimisticFilesStore.getState().confirmPendingDesign(tempId, real);
    const { pendingDesigns } = useOptimisticFilesStore.getState();
    expect(pendingDesigns.some((d) => d.id === tempId)).toBe(false);
    expect(pendingDesigns.some((d) => d.id === real.id)).toBe(true);
  });

  it("forwards an in-flight rename override from temp id to real id", () => {
    const tempId = nextPendingDesignId();
    useOptimisticFilesStore.getState().addPendingDesign(makeDesign({ id: tempId }));
    useOptimisticFilesStore.getState().setDesignRename(tempId, "Renamed Design");
    useOptimisticFilesStore
      .getState()
      .confirmPendingDesign(tempId, makeDesign({ id: "real-design-1" }));
    const { designRenameOverrides } = useOptimisticFilesStore.getState();
    expect(designRenameOverrides[tempId]).toBeUndefined();
    expect(designRenameOverrides["real-design-1"]).toBe("Renamed Design");
  });

  it("forwards an in-flight folder override from temp id to real id", () => {
    const tempId = nextPendingDesignId();
    useOptimisticFilesStore.getState().addPendingDesign(makeDesign({ id: tempId }));
    useOptimisticFilesStore.getState().setDesignFolder(tempId, "folder-1");
    useOptimisticFilesStore
      .getState()
      .confirmPendingDesign(tempId, makeDesign({ id: "real-design-1" }));
    const { designFolderOverrides } = useOptimisticFilesStore.getState();
    expect(tempId in designFolderOverrides).toBe(false);
    expect(designFolderOverrides["real-design-1"]).toBe("folder-1");
  });
});

// ---------------------------------------------------------------------------
// dropPendingFolder / dropPendingDesign
// ---------------------------------------------------------------------------

describe("dropPendingFolder", () => {
  it("removes the entry by temp id", () => {
    const tempId = nextPendingFolderId();
    useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
    useOptimisticFilesStore.getState().dropPendingFolder(tempId);
    expect(
      useOptimisticFilesStore.getState().pendingFolders.some((f) => f.id === tempId),
    ).toBe(false);
  });

  it("is a no-op on an unknown id", () => {
    expect(() =>
      useOptimisticFilesStore.getState().dropPendingFolder("ghost"),
    ).not.toThrow();
    expect(useOptimisticFilesStore.getState().pendingFolders).toHaveLength(0);
  });
});

describe("dropPendingDesign", () => {
  it("removes the entry by temp id", () => {
    const tempId = nextPendingDesignId();
    useOptimisticFilesStore.getState().addPendingDesign(makeDesign({ id: tempId }));
    useOptimisticFilesStore.getState().dropPendingDesign(tempId);
    expect(
      useOptimisticFilesStore.getState().pendingDesigns.some((d) => d.id === tempId),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markFolderDeleted / unmarkFolderDeleted
// ---------------------------------------------------------------------------

describe("markFolderDeleted", () => {
  it("adds the id to deletedFolderIds", () => {
    useOptimisticFilesStore.getState().markFolderDeleted("folder-1");
    expect(useOptimisticFilesStore.getState().deletedFolderIds.has("folder-1")).toBe(true);
  });

  it("is idempotent on repeat calls", () => {
    useOptimisticFilesStore.getState().markFolderDeleted("folder-1");
    useOptimisticFilesStore.getState().markFolderDeleted("folder-1");
    expect(useOptimisticFilesStore.getState().deletedFolderIds.size).toBe(1);
  });
});

describe("unmarkFolderDeleted", () => {
  it("removes the id from deletedFolderIds", () => {
    useOptimisticFilesStore.getState().markFolderDeleted("folder-1");
    useOptimisticFilesStore.getState().unmarkFolderDeleted("folder-1");
    expect(useOptimisticFilesStore.getState().deletedFolderIds.has("folder-1")).toBe(false);
  });

  it("is a no-op on an unknown id", () => {
    expect(() =>
      useOptimisticFilesStore.getState().unmarkFolderDeleted("ghost"),
    ).not.toThrow();
  });
});

describe("markDesignDeleted / unmarkDesignDeleted", () => {
  it("adds and removes the id", () => {
    useOptimisticFilesStore.getState().markDesignDeleted("design-1");
    expect(useOptimisticFilesStore.getState().deletedDesignIds.has("design-1")).toBe(true);
    useOptimisticFilesStore.getState().unmarkDesignDeleted("design-1");
    expect(useOptimisticFilesStore.getState().deletedDesignIds.has("design-1")).toBe(false);
  });

  it("markDesignDeleted is idempotent", () => {
    useOptimisticFilesStore.getState().markDesignDeleted("design-1");
    useOptimisticFilesStore.getState().markDesignDeleted("design-1");
    expect(useOptimisticFilesStore.getState().deletedDesignIds.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// setFolderRename / clearFolderRename
// ---------------------------------------------------------------------------

describe("setFolderRename / clearFolderRename", () => {
  it("sets a rename override for a folder", () => {
    useOptimisticFilesStore.getState().setFolderRename("folder-1", "New Name");
    expect(useOptimisticFilesStore.getState().folderRenameOverrides["folder-1"]).toBe(
      "New Name",
    );
  });

  it("overwrites an existing rename override", () => {
    useOptimisticFilesStore.getState().setFolderRename("folder-1", "First");
    useOptimisticFilesStore.getState().setFolderRename("folder-1", "Second");
    expect(useOptimisticFilesStore.getState().folderRenameOverrides["folder-1"]).toBe(
      "Second",
    );
  });

  it("clears the rename override", () => {
    useOptimisticFilesStore.getState().setFolderRename("folder-1", "Name");
    useOptimisticFilesStore.getState().clearFolderRename("folder-1");
    expect(
      useOptimisticFilesStore.getState().folderRenameOverrides["folder-1"],
    ).toBeUndefined();
  });

  it("clearFolderRename is a no-op when no override exists", () => {
    expect(() =>
      useOptimisticFilesStore.getState().clearFolderRename("ghost"),
    ).not.toThrow();
  });
});

describe("setDesignRename / clearDesignRename", () => {
  it("sets and clears a rename override for a design", () => {
    useOptimisticFilesStore.getState().setDesignRename("design-1", "New Name");
    expect(useOptimisticFilesStore.getState().designRenameOverrides["design-1"]).toBe(
      "New Name",
    );
    useOptimisticFilesStore.getState().clearDesignRename("design-1");
    expect(
      useOptimisticFilesStore.getState().designRenameOverrides["design-1"],
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setFolderParent / clearFolderParent
// ---------------------------------------------------------------------------

describe("setFolderParent / clearFolderParent", () => {
  it("sets a parent override", () => {
    useOptimisticFilesStore.getState().setFolderParent("folder-2", "folder-1");
    expect(useOptimisticFilesStore.getState().folderParentOverrides["folder-2"]).toBe(
      "folder-1",
    );
  });

  it("accepts null as a valid destination (move to root)", () => {
    useOptimisticFilesStore.getState().setFolderParent("folder-2", null);
    // null is meaningful — the key must exist, not just be falsy
    expect("folder-2" in useOptimisticFilesStore.getState().folderParentOverrides).toBe(true);
    expect(useOptimisticFilesStore.getState().folderParentOverrides["folder-2"]).toBeNull();
  });

  it("clears the parent override", () => {
    useOptimisticFilesStore.getState().setFolderParent("folder-2", "folder-1");
    useOptimisticFilesStore.getState().clearFolderParent("folder-2");
    expect(
      "folder-2" in useOptimisticFilesStore.getState().folderParentOverrides,
    ).toBe(false);
  });

  it("clearFolderParent is a no-op when no override exists", () => {
    expect(() =>
      useOptimisticFilesStore.getState().clearFolderParent("ghost"),
    ).not.toThrow();
  });
});

describe("setDesignFolder / clearDesignFolder", () => {
  it("sets and clears a folder override for a design", () => {
    useOptimisticFilesStore.getState().setDesignFolder("design-1", "folder-1");
    expect(useOptimisticFilesStore.getState().designFolderOverrides["design-1"]).toBe(
      "folder-1",
    );
    useOptimisticFilesStore.getState().clearDesignFolder("design-1");
    expect(
      "design-1" in useOptimisticFilesStore.getState().designFolderOverrides,
    ).toBe(false);
  });

  it("accepts null as a valid destination (move to root)", () => {
    useOptimisticFilesStore.getState().setDesignFolder("design-1", null);
    expect("design-1" in useOptimisticFilesStore.getState().designFolderOverrides).toBe(true);
    expect(useOptimisticFilesStore.getState().designFolderOverrides["design-1"]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reconcile
// ---------------------------------------------------------------------------

describe("reconcile", () => {
  const { reconcile } = useOptimisticFilesStore.getState();

  describe("pending creates", () => {
    it("drops a pending folder once its real id appears server-side", () => {
      const tempId = nextPendingFolderId();
      useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
      // Simulate onSuccess swapping temp → real, then reconcile with server data
      useOptimisticFilesStore
        .getState()
        .confirmPendingFolder(tempId, makeFolder({ id: "real-folder-1" }));
      reconcile({
        serverFolders: [makeFolder({ id: "real-folder-1" })],
        serverDesigns: [],
      });
      expect(
        useOptimisticFilesStore.getState().pendingFolders.some((f) => f.id === "real-folder-1"),
      ).toBe(false);
    });

    it("keeps a pending folder whose id has not yet appeared server-side", () => {
      const tempId = nextPendingFolderId();
      useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
      reconcile({ serverFolders: [], serverDesigns: [] });
      expect(
        useOptimisticFilesStore.getState().pendingFolders.some((f) => f.id === tempId),
      ).toBe(true);
    });

    it("drops a pending design once its real id appears server-side", () => {
      const tempId = nextPendingDesignId();
      useOptimisticFilesStore.getState().addPendingDesign(makeDesign({ id: tempId }));
      useOptimisticFilesStore
        .getState()
        .confirmPendingDesign(tempId, makeDesign({ id: "real-design-1" }));
      reconcile({
        serverFolders: [],
        serverDesigns: [makeDesign({ id: "real-design-1" })],
      });
      expect(
        useOptimisticFilesStore.getState().pendingDesigns.some((d) => d.id === "real-design-1"),
      ).toBe(false);
    });

    it("keeps a pending design whose id has not yet appeared server-side", () => {
      const tempId = nextPendingDesignId();
      useOptimisticFilesStore.getState().addPendingDesign(makeDesign({ id: tempId }));
      reconcile({ serverFolders: [], serverDesigns: [] });
      expect(
        useOptimisticFilesStore.getState().pendingDesigns.some((d) => d.id === tempId),
      ).toBe(true);
    });
  });

  describe("deletion markers", () => {
    it("keeps a folder deletion marker while the item still exists on the server (hides it)", () => {
      useOptimisticFilesStore.getState().markFolderDeleted("folder-1");
      reconcile({
        serverFolders: [makeFolder({ id: "folder-1" })],
        serverDesigns: [],
      });
      expect(useOptimisticFilesStore.getState().deletedFolderIds.has("folder-1")).toBe(true);
    });

    it("drops a folder deletion marker once the server confirms the item is gone", () => {
      useOptimisticFilesStore.getState().markFolderDeleted("folder-1");
      reconcile({ serverFolders: [], serverDesigns: [] });
      expect(useOptimisticFilesStore.getState().deletedFolderIds.has("folder-1")).toBe(false);
    });

    it("keeps a design deletion marker while the item still exists on the server", () => {
      useOptimisticFilesStore.getState().markDesignDeleted("design-1");
      reconcile({
        serverFolders: [],
        serverDesigns: [makeDesign({ id: "design-1" })],
      });
      expect(useOptimisticFilesStore.getState().deletedDesignIds.has("design-1")).toBe(true);
    });

    it("drops a design deletion marker once the server confirms the item is gone", () => {
      useOptimisticFilesStore.getState().markDesignDeleted("design-1");
      reconcile({ serverFolders: [], serverDesigns: [] });
      expect(useOptimisticFilesStore.getState().deletedDesignIds.has("design-1")).toBe(false);
    });
  });

  describe("rename overrides", () => {
    it("drops a folder rename override when the server name now matches", () => {
      useOptimisticFilesStore.getState().setFolderRename("folder-1", "New Name");
      reconcile({
        serverFolders: [makeFolder({ id: "folder-1", name: "New Name" })],
        serverDesigns: [],
      });
      expect(
        useOptimisticFilesStore.getState().folderRenameOverrides["folder-1"],
      ).toBeUndefined();
    });

    it("keeps a folder rename override when the server name still differs", () => {
      useOptimisticFilesStore.getState().setFolderRename("folder-1", "New Name");
      reconcile({
        serverFolders: [makeFolder({ id: "folder-1", name: "Old Name" })],
        serverDesigns: [],
      });
      expect(useOptimisticFilesStore.getState().folderRenameOverrides["folder-1"]).toBe(
        "New Name",
      );
    });

    it("drops an orphaned folder rename override for a real id no longer on the server", () => {
      useOptimisticFilesStore.getState().setFolderRename("folder-gone", "Whatever");
      reconcile({ serverFolders: [], serverDesigns: [] });
      expect(
        useOptimisticFilesStore.getState().folderRenameOverrides["folder-gone"],
      ).toBeUndefined();
    });

    it("keeps a folder rename override for a temp-prefixed id (unconfirmed create)", () => {
      const tempId = nextPendingFolderId();
      useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
      useOptimisticFilesStore.getState().setFolderRename(tempId, "Eager Rename");
      reconcile({ serverFolders: [], serverDesigns: [] });
      expect(useOptimisticFilesStore.getState().folderRenameOverrides[tempId]).toBe(
        "Eager Rename",
      );
    });

    it("drops a design rename override when the server name now matches", () => {
      useOptimisticFilesStore.getState().setDesignRename("design-1", "Final");
      reconcile({
        serverFolders: [],
        serverDesigns: [makeDesign({ id: "design-1", name: "Final" })],
      });
      expect(
        useOptimisticFilesStore.getState().designRenameOverrides["design-1"],
      ).toBeUndefined();
    });

    it("keeps a design rename override when the server name still differs", () => {
      useOptimisticFilesStore.getState().setDesignRename("design-1", "Final");
      reconcile({
        serverFolders: [],
        serverDesigns: [makeDesign({ id: "design-1", name: "Draft" })],
      });
      expect(useOptimisticFilesStore.getState().designRenameOverrides["design-1"]).toBe(
        "Final",
      );
    });
  });

  describe("move overrides", () => {
    it("drops a folder parent override when the server parentId now matches", () => {
      useOptimisticFilesStore.getState().setFolderParent("folder-2", "folder-1");
      reconcile({
        serverFolders: [
          makeFolder({ id: "folder-1" }),
          makeFolder({ id: "folder-2", parentId: "folder-1" }),
        ],
        serverDesigns: [],
      });
      expect(
        "folder-2" in useOptimisticFilesStore.getState().folderParentOverrides,
      ).toBe(false);
    });

    it("keeps a folder parent override when the server parentId still differs", () => {
      useOptimisticFilesStore.getState().setFolderParent("folder-2", "folder-1");
      reconcile({
        serverFolders: [
          makeFolder({ id: "folder-1" }),
          makeFolder({ id: "folder-2", parentId: null }),
        ],
        serverDesigns: [],
      });
      expect(useOptimisticFilesStore.getState().folderParentOverrides["folder-2"]).toBe(
        "folder-1",
      );
    });

    it("drops a folder parent override when the destination folder has disappeared", () => {
      // User moved folder-2 into folder-1, but someone deleted folder-1 in another tab
      useOptimisticFilesStore.getState().setFolderParent("folder-2", "folder-1");
      reconcile({
        // folder-1 is gone from server
        serverFolders: [makeFolder({ id: "folder-2", parentId: null })],
        serverDesigns: [],
      });
      expect(
        "folder-2" in useOptimisticFilesStore.getState().folderParentOverrides,
      ).toBe(false);
    });

    it("keeps a null (root) parent override when server parentId still differs", () => {
      useOptimisticFilesStore.getState().setFolderParent("folder-2", null);
      reconcile({
        serverFolders: [makeFolder({ id: "folder-2", parentId: "folder-1" })],
        serverDesigns: [],
      });
      expect("folder-2" in useOptimisticFilesStore.getState().folderParentOverrides).toBe(
        true,
      );
      expect(useOptimisticFilesStore.getState().folderParentOverrides["folder-2"]).toBeNull();
    });

    it("drops a null (root) parent override when server parentId also matches null", () => {
      useOptimisticFilesStore.getState().setFolderParent("folder-2", null);
      reconcile({
        serverFolders: [makeFolder({ id: "folder-2", parentId: null })],
        serverDesigns: [],
      });
      expect(
        "folder-2" in useOptimisticFilesStore.getState().folderParentOverrides,
      ).toBe(false);
    });

    it("keeps a folder parent override for a temp-prefixed id not yet confirmed", () => {
      const tempId = nextPendingFolderId();
      useOptimisticFilesStore.getState().addPendingFolder(makeFolder({ id: tempId }));
      useOptimisticFilesStore.getState().setFolderParent(tempId, "folder-1");
      reconcile({ serverFolders: [makeFolder({ id: "folder-1" })], serverDesigns: [] });
      expect("folder-1" in useOptimisticFilesStore.getState().folderParentOverrides).toBe(
        false,
      );
      expect(tempId in useOptimisticFilesStore.getState().folderParentOverrides).toBe(true);
    });

    it("drops a design folder override when the server folderId now matches", () => {
      useOptimisticFilesStore.getState().setDesignFolder("design-1", "folder-1");
      reconcile({
        serverFolders: [makeFolder({ id: "folder-1" })],
        serverDesigns: [makeDesign({ id: "design-1", folderId: "folder-1" })],
      });
      expect(
        "design-1" in useOptimisticFilesStore.getState().designFolderOverrides,
      ).toBe(false);
    });

    it("keeps a design folder override when the server folderId still differs", () => {
      useOptimisticFilesStore.getState().setDesignFolder("design-1", "folder-1");
      reconcile({
        serverFolders: [makeFolder({ id: "folder-1" })],
        serverDesigns: [makeDesign({ id: "design-1", folderId: null })],
      });
      expect(useOptimisticFilesStore.getState().designFolderOverrides["design-1"]).toBe(
        "folder-1",
      );
    });

    it("drops a design folder override when the destination folder has disappeared", () => {
      useOptimisticFilesStore.getState().setDesignFolder("design-1", "folder-gone");
      reconcile({
        serverFolders: [],
        serverDesigns: [makeDesign({ id: "design-1", folderId: null })],
      });
      expect(
        "design-1" in useOptimisticFilesStore.getState().designFolderOverrides,
      ).toBe(false);
    });
  });

  describe("no-op optimization", () => {
    it("does not change state when everything is already in sync", () => {
      const before = useOptimisticFilesStore.getState();
      reconcile({ serverFolders: [], serverDesigns: [] });
      // State should be identical — no pending/deleted/override entries, nothing to clean up.
      const after = useOptimisticFilesStore.getState();
      expect(after.pendingFolders).toEqual(before.pendingFolders);
      expect(after.pendingDesigns).toEqual(before.pendingDesigns);
      expect(after.deletedFolderIds.size).toBe(before.deletedFolderIds.size);
      expect(after.folderRenameOverrides).toEqual(before.folderRenameOverrides);
    });
  });
});

// ---------------------------------------------------------------------------
// applyOptimisticOverlays (pure function)
// ---------------------------------------------------------------------------

describe("applyOptimisticOverlays", () => {
  const emptyOverlay = {
    pendingFolders: [],
    pendingDesigns: [],
    deletedFolderIds: new Set<string>(),
    deletedDesignIds: new Set<string>(),
    folderRenameOverrides: {},
    designRenameOverrides: {},
    folderParentOverrides: {},
    designFolderOverrides: {},
  } as const;

  it("returns server data unchanged when the overlay is empty", () => {
    const folders = [makeFolder({ id: "f1" }), makeFolder({ id: "f2", parentId: "f1" })];
    const designs = [makeDesign({ id: "d1" })];
    const result = applyOptimisticOverlays(folders, designs, emptyOverlay);
    expect(result.folders).toEqual(folders);
    expect(result.designs).toEqual(designs);
  });

  it("hides folders that are marked as deleted", () => {
    const folders = [makeFolder({ id: "f1" }), makeFolder({ id: "f2" })];
    const result = applyOptimisticOverlays(folders, [], {
      ...emptyOverlay,
      deletedFolderIds: new Set(["f1"]),
    });
    expect(result.folders.map((f) => f.id)).toEqual(["f2"]);
  });

  it("hides designs that are marked as deleted", () => {
    const designs = [makeDesign({ id: "d1" }), makeDesign({ id: "d2" })];
    const result = applyOptimisticOverlays([], designs, {
      ...emptyOverlay,
      deletedDesignIds: new Set(["d2"]),
    });
    expect(result.designs.map((d) => d.id)).toEqual(["d1"]);
  });

  it("applies a rename override to a folder", () => {
    const result = applyOptimisticOverlays(
      [makeFolder({ id: "f1", name: "Old" })],
      [],
      { ...emptyOverlay, folderRenameOverrides: { "f1": "New" } },
    );
    expect(result.folders[0].name).toBe("New");
  });

  it("applies a rename override to a design", () => {
    const result = applyOptimisticOverlays(
      [],
      [makeDesign({ id: "d1", name: "Old" })],
      { ...emptyOverlay, designRenameOverrides: { "d1": "New" } },
    );
    expect(result.designs[0].name).toBe("New");
  });

  it("applies a parentId move override to a folder", () => {
    const result = applyOptimisticOverlays(
      [makeFolder({ id: "f1", parentId: null })],
      [],
      { ...emptyOverlay, folderParentOverrides: { "f1": "parent-folder" } },
    );
    expect(result.folders[0].parentId).toBe("parent-folder");
  });

  it("applies a null (root) parentId override to a folder", () => {
    const result = applyOptimisticOverlays(
      [makeFolder({ id: "f1", parentId: "some-parent" })],
      [],
      { ...emptyOverlay, folderParentOverrides: { "f1": null } },
    );
    expect(result.folders[0].parentId).toBeNull();
  });

  it("applies a folderId move override to a design", () => {
    const result = applyOptimisticOverlays(
      [],
      [makeDesign({ id: "d1", folderId: null })],
      { ...emptyOverlay, designFolderOverrides: { "d1": "folder-1" } },
    );
    expect(result.designs[0].folderId).toBe("folder-1");
  });

  it("applies a null (root) folderId override to a design", () => {
    const result = applyOptimisticOverlays(
      [],
      [makeDesign({ id: "d1", folderId: "folder-1" })],
      { ...emptyOverlay, designFolderOverrides: { "d1": null } },
    );
    expect(result.designs[0].folderId).toBeNull();
  });

  it("appends pending folders not yet in server data", () => {
    const tempId = nextPendingFolderId();
    const pending = makeFolder({ id: tempId, name: "New Folder" });
    const result = applyOptimisticOverlays([], [], {
      ...emptyOverlay,
      pendingFolders: [pending],
    });
    expect(result.folders).toContainEqual(pending);
  });

  it("appends pending designs not yet in server data", () => {
    const tempId = nextPendingDesignId();
    const pending = makeDesign({ id: tempId, name: "New Design" });
    const result = applyOptimisticOverlays([], [], {
      ...emptyOverlay,
      pendingDesigns: [pending],
    });
    expect(result.designs).toContainEqual(pending);
  });

  it("does not duplicate a pending folder that already appears in server data", () => {
    // Happens during the flicker frame between onSuccess (which updates the
    // pending entry to the real id) and reconcile() firing.
    const realFolder = makeFolder({ id: "real-folder-1" });
    const result = applyOptimisticOverlays([realFolder], [], {
      ...emptyOverlay,
      pendingFolders: [realFolder],
    });
    expect(result.folders.filter((f) => f.id === "real-folder-1")).toHaveLength(1);
  });

  it("does not duplicate a pending design that already appears in server data", () => {
    const realDesign = makeDesign({ id: "real-design-1" });
    const result = applyOptimisticOverlays([], [realDesign], {
      ...emptyOverlay,
      pendingDesigns: [realDesign],
    });
    expect(result.designs.filter((d) => d.id === "real-design-1")).toHaveLength(1);
  });

  it("combines delete + rename + move overlays correctly", () => {
    const folders = [
      makeFolder({ id: "f1", name: "Keep" }),
      makeFolder({ id: "f2", name: "Deleted" }),
      makeFolder({ id: "f3", name: "Moved", parentId: null }),
    ];
    const result = applyOptimisticOverlays(folders, [], {
      ...emptyOverlay,
      deletedFolderIds: new Set(["f2"]),
      folderRenameOverrides: { "f1": "Renamed" },
      folderParentOverrides: { "f3": "f1" },
    });
    expect(result.folders).toHaveLength(2);
    expect(result.folders.find((f) => f.id === "f1")?.name).toBe("Renamed");
    expect(result.folders.find((f) => f.id === "f3")?.parentId).toBe("f1");
  });
});
