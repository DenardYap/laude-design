"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { MODEL_OPTIONS } from "@/lib/workspace/types";
import type { ChatSessionDTO, SessionUsage } from "@/lib/workspace/types";
import type { UploadedFile } from "@/lib/api/uploads";
import type { TagMarker } from "@/lib/workspace/tag-markers";

export type CanvasTabKey = "files" | `design:${string}`;

export type ToolMode = "idle" | "tag" | "screenshot-area" | "draw";

export interface PendingTag extends TagMarker {
  /** Local-only id used as a React key + to remove the chip. */
  id: string;
}

// Stable empty references so selectors that fall back to "no value" return the
// SAME array/object identity on every read. Without this, `?? []` creates a
// fresh array per render and React's useSyncExternalStore bails out with
// "The result of getServerSnapshot should be cached to avoid an infinite loop".
export const EMPTY_TAB_LIST: readonly string[] = Object.freeze([]);
export const EMPTY_ATTACHMENTS: ReadonlyArray<UploadedFile> = Object.freeze([]);
export const EMPTY_TAGS: ReadonlyArray<PendingTag> = Object.freeze([]);

// Discrete zoom stops the canvas snaps to (matches the rhythm Chrome uses for
// ⌘+ / ⌘-). 100% sits in the middle so resetZoom can find it by index.
export const ZOOM_LEVELS = [
  0.25, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
] as const;
export const DEFAULT_ZOOM = 1;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

function nextZoomUp(current: number): number {
  for (const z of ZOOM_LEVELS) if (z > current + 1e-6) return z;
  return MAX_ZOOM;
}
function nextZoomDown(current: number): number {
  for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
    if (ZOOM_LEVELS[i]! < current - 1e-6) return ZOOM_LEVELS[i]!;
  }
  return MIN_ZOOM;
}

interface WorkspaceState {
  // Active session per project
  activeSessionByProject: Record<string, string | undefined>;
  setActiveSession: (projectId: string, sessionId: string) => void;

  // Open session tabs per project. Closing a session tab removes it from this
  // list but does NOT delete the underlying chat session — the user can
  // re-open it from the History popover. Sessions that aren't in this list
  // simply aren't currently rendered as tabs.
  openSessionsByProject: Record<string, string[]>;
  openSessionTab: (projectId: string, sessionId: string) => void;
  closeSessionTab: (projectId: string, sessionId: string) => void;
  setSessionTabOrder: (projectId: string, order: string[]) => void;
  ensureSessionTabsHydrated: (
    projectId: string,
    knownSessionIds: string[],
    fallbackActiveSessionId?: string,
  ) => void;

  // Selected model per project (defaults to first option)
  selectedModelByProject: Record<string, { provider: string; modelId: string } | undefined>;
  setSelectedModel: (projectId: string, modelId: string, provider: string) => void;

  // Open canvas tabs (the Files tab is implicit and always present)
  openTabsByProject: Record<string, string[]>;
  activeTabByProject: Record<string, CanvasTabKey>;
  openDesignTab: (projectId: string, designId: string) => void;
  closeDesignTab: (projectId: string, designId: string) => void;
  setActiveTab: (projectId: string, tab: CanvasTabKey) => void;
  reorderDesignTabs: (
    projectId: string,
    fromId: string,
    toId: string,
    position: "before" | "after",
  ) => void;
  setDesignTabOrder: (projectId: string, order: string[]) => void;

  // Canvas zoom — modeled after browser ctrl+/ctrl-/ctrl-0. `zoom` is the
  // visual scale (1 = 100%); the helpers step through the predefined
  // ZOOM_LEVELS rather than letting setZoom land between stops, so each press
  // produces a perceptible change.
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Toolbar mode
  tool: ToolMode;
  setTool: (m: ToolMode) => void;

  // Resizable layout — chat panel size as %
  chatPanelSize: number;
  setChatPanelSize: (size: number) => void;

  // Cmd+K palette
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;

  // Export dialog
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;

  // Composer draft text per session
  draftBySession: Record<string, string>;
  setDraft: (sessionId: string, text: string) => void;

  // Synthesized chat messages enqueued from outside the chat pane (e.g. the
  // Questions tab living in the canvas). The chat pane's `useChat` reads this
  // for the active session, sends it, and clears it.
  pendingChatMessageBySession: Record<string, string | undefined>;
  enqueueChatMessage: (sessionId: string, text: string) => void;
  consumeChatMessage: (sessionId: string) => void;

  // Pending attachments (uploads + screenshots) to send with next message
  pendingAttachmentsBySession: Record<string, UploadedFile[]>;
  addPendingAttachment: (sessionId: string, file: UploadedFile) => void;
  removePendingAttachment: (sessionId: string, url: string) => void;
  clearPendingAttachments: (sessionId: string) => void;

  // Pending tagged elements (from the canvas highlight tool) to send as
  // attachment-style chips with the next message.
  pendingTagsBySession: Record<string, PendingTag[]>;
  addPendingTag: (sessionId: string, tag: TagMarker) => void;
  removePendingTag: (sessionId: string, id: string) => void;
  clearPendingTags: (sessionId: string) => void;

  // Auto-generated session titles streamed back from the chat API. Used to
  // update the tab label instantly without waiting for `router.refresh()` to
  // pull fresh server data.
  sessionTitleOverrides: Record<string, string>;
  setSessionTitleOverride: (sessionId: string, title: string) => void;

  // Sessions that currently have an in-flight agent turn. Set/cleared by the
  // chat pane based on `useChat` status. Powers the "agent is working" dot
  // on session tabs so the user has peripheral awareness even when looking
  // at the canvas. Runtime-only — never persisted, since streaming state
  // doesn't survive a reload anyway.
  streamingSessionIds: Record<string, true>;
  setSessionStreaming: (sessionId: string, streaming: boolean) => void;

  // Cumulative usage stats for the chatbox indicator (tokens used, summaries,
  // and dollar cost). Hydrated from the server on mount via
  // `hydrateSessionUsage`, then patched live as each turn finishes via the
  // `data-session-usage` stream part. Persisted to DB by the chat route, so
  // these values survive reload — `hydrateSessionUsage` rewrites the map on
  // every workspace mount.
  sessionUsageById: Record<string, SessionUsage>;
  hydrateSessionUsage: (sessions: ChatSessionDTO[]) => void;
  setSessionUsage: (sessionId: string, usage: SessionUsage) => void;
}

const DEFAULT_MODEL = MODEL_OPTIONS[0];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeSessionByProject: {},
      setActiveSession: (projectId, sessionId) =>
        set((s) => {
          // Selecting a session always implies it should be visible as a tab.
          const open = s.openSessionsByProject[projectId] ?? [];
          const nextOpen = open.includes(sessionId) ? open : [...open, sessionId];
          return {
            activeSessionByProject: {
              ...s.activeSessionByProject,
              [projectId]: sessionId,
            },
            openSessionsByProject: {
              ...s.openSessionsByProject,
              [projectId]: nextOpen,
            },
          };
        }),

      openSessionsByProject: {},
      openSessionTab: (projectId, sessionId) =>
        set((s) => {
          const open = s.openSessionsByProject[projectId] ?? [];
          const nextOpen = open.includes(sessionId) ? open : [...open, sessionId];
          return {
            openSessionsByProject: {
              ...s.openSessionsByProject,
              [projectId]: nextOpen,
            },
            activeSessionByProject: {
              ...s.activeSessionByProject,
              [projectId]: sessionId,
            },
          };
        }),
      closeSessionTab: (projectId, sessionId) =>
        set((s) => {
          const open = s.openSessionsByProject[projectId] ?? [];
          const idx = open.indexOf(sessionId);
          if (idx === -1) return {};
          const next = open.filter((id) => id !== sessionId);
          const wasActive = s.activeSessionByProject[projectId] === sessionId;
          // If we just closed the active tab, prefer the neighbour to the
          // right; fall back to the left so the user is never stranded on a
          // tab that no longer exists.
          let activeNext = s.activeSessionByProject[projectId];
          if (wasActive) {
            activeNext = next[idx] ?? next[idx - 1] ?? next[0] ?? undefined;
          }
          return {
            openSessionsByProject: {
              ...s.openSessionsByProject,
              [projectId]: next,
            },
            activeSessionByProject: {
              ...s.activeSessionByProject,
              [projectId]: activeNext,
            },
          };
        }),
      setSessionTabOrder: (projectId, order) =>
        set((s) => ({
          openSessionsByProject: {
            ...s.openSessionsByProject,
            [projectId]: order,
          },
        })),
      ensureSessionTabsHydrated: (projectId, knownSessionIds, fallback) =>
        set((s) => {
          const known = new Set(knownSessionIds);
          const existing = s.openSessionsByProject[projectId];
          const activeId = s.activeSessionByProject[projectId];
          // First visit (no persisted entry yet): open just the fallback (or
          // the first known session) and make it active. On subsequent
          // visits, only prune ids that no longer exist server-side so we
          // don't surprise the user by re-opening tabs they explicitly
          // closed.
          if (!existing) {
            const seedId =
              fallback && known.has(fallback)
                ? fallback
                : (knownSessionIds[0] ?? undefined);
            const seed = seedId ? [seedId] : [];
            return {
              openSessionsByProject: {
                ...s.openSessionsByProject,
                [projectId]: seed,
              },
              activeSessionByProject: {
                ...s.activeSessionByProject,
                [projectId]: seedId ?? activeId,
              },
            };
          }
          const pruned = existing.filter((id) => known.has(id));
          // Even if `existing` matches `pruned`, the persisted active session
          // may now be stale (deleted server-side). Drop it so chat-pane
          // doesn't try to fetch messages for a dead id.
          const activeNext =
            activeId && known.has(activeId) ? activeId : pruned[0];
          if (
            pruned.length === existing.length &&
            activeNext === activeId
          ) {
            return {};
          }
          return {
            openSessionsByProject: {
              ...s.openSessionsByProject,
              [projectId]: pruned,
            },
            activeSessionByProject: {
              ...s.activeSessionByProject,
              [projectId]: activeNext,
            },
          };
        }),

      selectedModelByProject: {},
      setSelectedModel: (projectId, modelId, provider) =>
        set((s) => ({
          selectedModelByProject: {
            ...s.selectedModelByProject,
            [projectId]: { provider, modelId },
          },
        })),

      openTabsByProject: {},
      activeTabByProject: {},
      openDesignTab: (projectId, designId) =>
        set((s) => {
          const open = s.openTabsByProject[projectId] ?? [];
          const next = open.includes(designId) ? open : [...open, designId];
          return {
            openTabsByProject: { ...s.openTabsByProject, [projectId]: next },
            activeTabByProject: {
              ...s.activeTabByProject,
              [projectId]: `design:${designId}` as CanvasTabKey,
            },
          };
        }),
      closeDesignTab: (projectId, designId) =>
        set((s) => {
          const open = s.openTabsByProject[projectId] ?? [];
          const idx = open.indexOf(designId);
          const next = open.filter((d) => d !== designId);
          const wasActive = s.activeTabByProject[projectId] === `design:${designId}`;
          let activeNext: CanvasTabKey = s.activeTabByProject[projectId] ?? "files";
          if (wasActive) {
            const fallback = next[idx] ?? next[idx - 1] ?? next[0];
            activeNext = fallback ? (`design:${fallback}` as CanvasTabKey) : "files";
          }
          return {
            openTabsByProject: { ...s.openTabsByProject, [projectId]: next },
            activeTabByProject: { ...s.activeTabByProject, [projectId]: activeNext },
          };
        }),
      setActiveTab: (projectId, tab) =>
        set((s) => ({
          activeTabByProject: { ...s.activeTabByProject, [projectId]: tab },
        })),
      reorderDesignTabs: (projectId, fromId, toId, position) =>
        set((s) => {
          const open = s.openTabsByProject[projectId] ?? [];
          if (fromId === toId) return {};
          const without = open.filter((id) => id !== fromId);
          const toIdx = without.indexOf(toId);
          if (toIdx === -1) return {};
          const insertAt = position === "before" ? toIdx : toIdx + 1;
          const next = [...without.slice(0, insertAt), fromId, ...without.slice(insertAt)];
          return { openTabsByProject: { ...s.openTabsByProject, [projectId]: next } };
        }),
      setDesignTabOrder: (projectId, order) =>
        set((s) => ({
          openTabsByProject: { ...s.openTabsByProject, [projectId]: order },
        })),

      zoom: DEFAULT_ZOOM,
      setZoom: (zoom) =>
        set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
      zoomIn: () => set((s) => ({ zoom: nextZoomUp(s.zoom) })),
      zoomOut: () => set((s) => ({ zoom: nextZoomDown(s.zoom) })),
      resetZoom: () => set({ zoom: DEFAULT_ZOOM }),

      tool: "idle",
      setTool: (tool) => set({ tool }),

      chatPanelSize: 30,
      setChatPanelSize: (chatPanelSize) => set({ chatPanelSize }),

      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

      exportOpen: false,
      setExportOpen: (exportOpen) => set({ exportOpen }),

      draftBySession: {},
      setDraft: (sessionId, text) =>
        set((s) => ({ draftBySession: { ...s.draftBySession, [sessionId]: text } })),

      pendingChatMessageBySession: {},
      enqueueChatMessage: (sessionId, text) =>
        set((s) => ({
          pendingChatMessageBySession: {
            ...s.pendingChatMessageBySession,
            [sessionId]: text,
          },
        })),
      consumeChatMessage: (sessionId) =>
        set((s) => {
          if (s.pendingChatMessageBySession[sessionId] === undefined) return {};
          const next = { ...s.pendingChatMessageBySession };
          delete next[sessionId];
          return { pendingChatMessageBySession: next };
        }),

      pendingAttachmentsBySession: {},
      addPendingAttachment: (sessionId, file) =>
        set((s) => ({
          pendingAttachmentsBySession: {
            ...s.pendingAttachmentsBySession,
            [sessionId]: [...(s.pendingAttachmentsBySession[sessionId] ?? []), file],
          },
        })),
      removePendingAttachment: (sessionId, url) =>
        set((s) => ({
          pendingAttachmentsBySession: {
            ...s.pendingAttachmentsBySession,
            [sessionId]: (s.pendingAttachmentsBySession[sessionId] ?? []).filter((a) => a.url !== url),
          },
        })),
      clearPendingAttachments: (sessionId) =>
        set((s) => ({
          pendingAttachmentsBySession: { ...s.pendingAttachmentsBySession, [sessionId]: [] },
        })),

      pendingTagsBySession: {},
      addPendingTag: (sessionId, tag) =>
        set((s) => {
          const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          return {
            pendingTagsBySession: {
              ...s.pendingTagsBySession,
              [sessionId]: [
                ...(s.pendingTagsBySession[sessionId] ?? []),
                { ...tag, id },
              ],
            },
          };
        }),
      removePendingTag: (sessionId, id) =>
        set((s) => ({
          pendingTagsBySession: {
            ...s.pendingTagsBySession,
            [sessionId]: (s.pendingTagsBySession[sessionId] ?? []).filter(
              (t) => t.id !== id,
            ),
          },
        })),
      clearPendingTags: (sessionId) =>
        set((s) => ({
          pendingTagsBySession: { ...s.pendingTagsBySession, [sessionId]: [] },
        })),

      sessionTitleOverrides: {},
      setSessionTitleOverride: (sessionId, title) =>
        set((s) => ({
          sessionTitleOverrides: { ...s.sessionTitleOverrides, [sessionId]: title },
        })),

      streamingSessionIds: {},
      setSessionStreaming: (sessionId, streaming) =>
        set((s) => {
          const isCurrentlyStreaming = Boolean(s.streamingSessionIds[sessionId]);
          if (isCurrentlyStreaming === streaming) return {};
          if (streaming) {
            return {
              streamingSessionIds: {
                ...s.streamingSessionIds,
                [sessionId]: true,
              },
            };
          }
          const next = { ...s.streamingSessionIds };
          delete next[sessionId];
          return { streamingSessionIds: next };
        }),

      sessionUsageById: {},
      hydrateSessionUsage: (sessions) =>
        set((s) => {
          const next = { ...s.sessionUsageById };
          for (const session of sessions) {
            // Server is authoritative on mount — overwrite any stale local
            // values (the persisted map can lag behind reality if the server
            // changed while the tab was closed).
            next[session.id] = session.usage;
          }
          return { sessionUsageById: next };
        }),
      setSessionUsage: (sessionId, usage) =>
        set((s) => ({
          sessionUsageById: { ...s.sessionUsageById, [sessionId]: usage },
        })),
    }),
    {
      name: "claude-design:workspace",
      partialize: (s) => ({
        activeSessionByProject: s.activeSessionByProject,
        openSessionsByProject: s.openSessionsByProject,
        selectedModelByProject: s.selectedModelByProject,
        openTabsByProject: s.openTabsByProject,
        activeTabByProject: s.activeTabByProject,
        chatPanelSize: s.chatPanelSize,
        zoom: s.zoom,
      }),
    },
  ),
);

export const DEFAULT_MODEL_OPTION = DEFAULT_MODEL;
