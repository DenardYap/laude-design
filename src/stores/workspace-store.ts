"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import { MODEL_OPTIONS } from "@/lib/workspace/types";
import type { ChatSessionDTO, SessionUsage } from "@/lib/workspace/types";
import type { UploadedFile } from "@/lib/api/uploads";
import type { TagMarker } from "@/lib/workspace/tag-markers";

/** The array of message parts the Composer sends — text, files, tag markers, etc. */
export type PendingComposerSubmission = UIMessagePart<UIDataTypes, UITools>[];

export type CanvasTabKey = "files" | `design:${string}`;

export type ToolMode = "idle" | "tag" | "screenshot-area" | "draw";

export interface PendingTag extends TagMarker {
  /** Local-only id used as a React key + to remove the chip. */
  id: string;
}

// Frozen empty arrays so `?? []` fallbacks always return the same reference.
// Without this, React's useSyncExternalStore throws an infinite loop warning.
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

export interface WorkspaceState {
  // Active session per project
  activeSessionByProject: Record<string, string | undefined>;
  setActiveSession: (projectId: string, sessionId: string) => void;

  // Which chat session tabs are open per project. Closing a tab removes it
  // here, but the underlying session is kept — re-open it from History.
  openSessionsByProject: Record<string, string[]>;
  openSessionTab: (projectId: string, sessionId: string) => void;
  closeSessionTab: (projectId: string, sessionId: string) => void;
  setSessionTabOrder: (projectId: string, order: string[]) => void;
  ensureSessionTabsHydrated: (
    projectId: string,
    knownSessionIds: string[],
    protectedSessionIds?: ReadonlyArray<string>,
  ) => void;

  // The last model the user picked in this project. New sessions start with this.
  defaultModelByProject: Record<
    string,
    { provider: string; modelId: string } | undefined
  >;

  // The model chosen for each session. Changing it in one session doesn't affect others.
  selectedModelBySession: Record<
    string,
    { provider: string; modelId: string } | undefined
  >;

  // Set the model for a session and also update the project default for future sessions.
  setSelectedModel: (
    projectId: string,
    sessionId: string,
    modelId: string,
    provider: string,
  ) => void;

  // Copy the project's default model into a new session (only runs once per session).
  seedSessionModel: (projectId: string, sessionId: string) => void;

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
  // Called on mount to clean up stale localStorage state. Removes open design
  // tabs deleted server-side, and resets the active tab to "files" if it
  // pointed at a deleted design.
  ensureCanvasTabsHydrated: (
    projectId: string,
    knownDesignIds: string[],
  ) => void;

  // Canvas zoom level (1 = 100%). zoomIn/zoomOut snap to predefined ZOOM_LEVELS,
  // mimicking browser ⌘+/⌘- behavior.
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

  // Plain-text messages queued to send from outside the chat pane (e.g. the
  // questions tool). ActiveSession reads and clears this on each render.
  pendingChatMessageBySession: Record<string, string | undefined>;
  enqueueChatMessage: (sessionId: string, text: string) => void;
  consumeChatMessage: (sessionId: string) => void;

  // The full Composer send payload (text + files + tags) queued per session.
  // Written on Send, read and cleared immediately by the matching ActiveSession.
  pendingComposerSubmissionBySession: Record<
    string,
    PendingComposerSubmission | undefined
  >;
  enqueueComposerSubmission: (
    sessionId: string,
    parts: PendingComposerSubmission,
  ) => void;
  consumeComposerSubmission: (sessionId: string) => void;

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

  // Session title overrides streamed back from the AI. Updates the tab label
  // instantly without waiting for a full server refresh.
  sessionTitleOverrides: Record<string, string>;
  setSessionTitleOverride: (sessionId: string, title: string) => void;

  // Sessions currently generating a response. Powers the "working" dot on tabs.
  // Not persisted — streaming state doesn't survive a page reload.
  streamingSessionIds: Record<string, true>;
  setSessionStreaming: (sessionId: string, streaming: boolean) => void;

  // Stop requests from the tab UI. ActiveSession reads this, calls stop(), then clears it.
  requestedStopBySession: Record<string, true>;
  requestSessionStop: (sessionId: string) => void;
  clearSessionStop: (sessionId: string) => void;

  // Token usage and cost per session for the context indicator. Loaded from
  // the server on mount, then updated live as each AI turn finishes.
  sessionUsageById: Record<string, SessionUsage>;
  hydrateSessionUsage: (sessions: ChatSessionDTO[]) => void;
  setSessionUsage: (sessionId: string, usage: SessionUsage) => void;

  // Message indices where summarization fired in each session (shown as a
  // divider in the chat). Not persisted.
  summarizationMarkersById: Record<string, number[]>;
  addSummarizationMarker: (sessionId: string, messageIndex: number) => void;

  // Per-session toggle for self-critique mode. When on, the agent reviews and
  // revises its own design after each pass (max 3 rounds). Persisted.
  selfCritiqueBySession: Record<string, boolean>;
  setSelfCritique: (sessionId: string, enabled: boolean) => void;

  // True once Zustand has finished reading from localStorage on startup.
  // Use this to avoid showing stale defaults before hydration completes.
  _hasHydrated: boolean;
  _setHasHydrated: (v: boolean) => void;

  // Moves all per-session state from one id to another. Called when a temp
  // session id is replaced by the real server id after creation.
  migrateSessionState: (fromId: string, toId: string) => void;
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
          const nextOpen = open.includes(sessionId)
            ? open
            : [...open, sessionId];
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
          const nextOpen = open.includes(sessionId)
            ? open
            : [...open, sessionId];
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
      ensureSessionTabsHydrated: (
        projectId,
        knownSessionIds,
        protectedSessionIds,
      ) =>
        set((s) => {
          const known = new Set(knownSessionIds);
          const protectedSet = new Set(protectedSessionIds ?? []);
          // Protected ids are newly created sessions not yet in the server list — keep them.
          const isValid = (id: string) => known.has(id) || protectedSet.has(id);
          const existing = s.openSessionsByProject[projectId];
          const activeId = s.activeSessionByProject[projectId];
          // First visit: start empty so SessionTabs auto-creates a fresh chat.
          // Subsequent visits: only prune sessions deleted server-side.
          if (!existing) {
            return {
              openSessionsByProject: {
                ...s.openSessionsByProject,
                [projectId]: [],
              },
            };
          }
          const pruned = existing.filter(isValid);
          // Also drop the active session if it was deleted server-side.
          // Default to undefined (new chat) rather than jumping to another tab.
          const activeNext =
            activeId && isValid(activeId) ? activeId : undefined;
          if (pruned.length === existing.length && activeNext === activeId) {
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

      defaultModelByProject: {},
      selectedModelBySession: {},
      setSelectedModel: (projectId, sessionId, modelId, provider) =>
        set((s) => ({
          defaultModelByProject: {
            ...s.defaultModelByProject,
            [projectId]: { provider, modelId },
          },
          selectedModelBySession: {
            ...s.selectedModelBySession,
            [sessionId]: { provider, modelId },
          },
        })),
      seedSessionModel: (projectId, sessionId) =>
        set((s) => {
          // Only seed once — don't overwrite an explicit selection.
          if (s.selectedModelBySession[sessionId]) return {};
          const def = s.defaultModelByProject[projectId];
          if (!def) return {};
          return {
            selectedModelBySession: {
              ...s.selectedModelBySession,
              [sessionId]: def,
            },
          };
        }),

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
          const wasActive =
            s.activeTabByProject[projectId] === `design:${designId}`;
          let activeNext: CanvasTabKey =
            s.activeTabByProject[projectId] ?? "files";
          if (wasActive) {
            const fallback = next[idx] ?? next[idx - 1] ?? next[0];
            activeNext = fallback
              ? (`design:${fallback}` as CanvasTabKey)
              : "files";
          }
          return {
            openTabsByProject: { ...s.openTabsByProject, [projectId]: next },
            activeTabByProject: {
              ...s.activeTabByProject,
              [projectId]: activeNext,
            },
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
          const next = [
            ...without.slice(0, insertAt),
            fromId,
            ...without.slice(insertAt),
          ];
          return {
            openTabsByProject: { ...s.openTabsByProject, [projectId]: next },
          };
        }),
      setDesignTabOrder: (projectId, order) =>
        set((s) => ({
          openTabsByProject: { ...s.openTabsByProject, [projectId]: order },
        })),
      ensureCanvasTabsHydrated: (projectId, knownDesignIds) =>
        set((s) => {
          const known = new Set(knownDesignIds);
          const existingOpen = s.openTabsByProject[projectId] ?? [];
          const existingActive: CanvasTabKey =
            s.activeTabByProject[projectId] ?? "files";

          const prunedOpen = existingOpen.filter((id) => known.has(id));

          // Fall back to "files" if the persisted active design was deleted.
          let activeNext: CanvasTabKey = existingActive;
          if (existingActive !== "files") {
            const designId = existingActive.replace(/^design:/, "");
            if (!known.has(designId)) {
              activeNext = "files";
            }
          }

          if (
            prunedOpen.length === existingOpen.length &&
            activeNext === existingActive
          ) {
            return {};
          }
          return {
            openTabsByProject: {
              ...s.openTabsByProject,
              [projectId]: prunedOpen,
            },
            activeTabByProject: {
              ...s.activeTabByProject,
              [projectId]: activeNext,
            },
          };
        }),

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
        set((s) => ({
          draftBySession: { ...s.draftBySession, [sessionId]: text },
        })),

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

      pendingComposerSubmissionBySession: {},
      enqueueComposerSubmission: (sessionId, parts) =>
        set((s) => ({
          pendingComposerSubmissionBySession: {
            ...s.pendingComposerSubmissionBySession,
            [sessionId]: parts,
          },
        })),
      consumeComposerSubmission: (sessionId) =>
        set((s) => {
          if (s.pendingComposerSubmissionBySession[sessionId] === undefined) {
            return {};
          }
          const next = { ...s.pendingComposerSubmissionBySession };
          delete next[sessionId];
          return { pendingComposerSubmissionBySession: next };
        }),

      pendingAttachmentsBySession: {},
      addPendingAttachment: (sessionId, file) =>
        set((s) => ({
          pendingAttachmentsBySession: {
            ...s.pendingAttachmentsBySession,
            [sessionId]: [
              ...(s.pendingAttachmentsBySession[sessionId] ?? []),
              file,
            ],
          },
        })),
      removePendingAttachment: (sessionId, url) =>
        set((s) => ({
          pendingAttachmentsBySession: {
            ...s.pendingAttachmentsBySession,
            [sessionId]: (
              s.pendingAttachmentsBySession[sessionId] ?? []
            ).filter((a) => a.url !== url),
          },
        })),
      clearPendingAttachments: (sessionId) =>
        set((s) => ({
          pendingAttachmentsBySession: {
            ...s.pendingAttachmentsBySession,
            [sessionId]: [],
          },
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
          sessionTitleOverrides: {
            ...s.sessionTitleOverrides,
            [sessionId]: title,
          },
        })),

      streamingSessionIds: {},
      setSessionStreaming: (sessionId, streaming) =>
        set((s) => {
          const isCurrentlyStreaming = Boolean(
            s.streamingSessionIds[sessionId],
          );
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

      requestedStopBySession: {},
      requestSessionStop: (sessionId) =>
        set((s) => ({
          requestedStopBySession: {
            ...s.requestedStopBySession,
            [sessionId]: true,
          },
        })),
      clearSessionStop: (sessionId) =>
        set((s) => {
          if (!s.requestedStopBySession[sessionId]) return {};
          const next = { ...s.requestedStopBySession };
          delete next[sessionId];
          return { requestedStopBySession: next };
        }),

      sessionUsageById: {},
      hydrateSessionUsage: (sessions) =>
        set((s) => {
          const next = { ...s.sessionUsageById };
          for (const session of sessions) {
            // Server values always win on mount.
            next[session.id] = session.usage;
          }
          return { sessionUsageById: next };
        }),
      setSessionUsage: (sessionId, usage) =>
        set((s) => ({
          sessionUsageById: { ...s.sessionUsageById, [sessionId]: usage },
        })),

      summarizationMarkersById: {},
      addSummarizationMarker: (sessionId, messageIndex) =>
        set((s) => {
          const prev = s.summarizationMarkersById[sessionId] ?? [];
          // Deduplicate — don't add the same index twice (e.g. on stream retry).
          if (prev.includes(messageIndex)) return {};
          return {
            summarizationMarkersById: {
              ...s.summarizationMarkersById,
              [sessionId]: [...prev, messageIndex],
            },
          };
        }),

      selfCritiqueBySession: {},
      setSelfCritique: (sessionId, enabled) =>
        set((s) => ({
          selfCritiqueBySession: {
            ...s.selfCritiqueBySession,
            [sessionId]: enabled,
          },
        })),

      _hasHydrated: false,
      _setHasHydrated: (v) => set({ _hasHydrated: v }),

      migrateSessionState: (fromId, toId) =>
        set((s) => {
          if (fromId === toId) return {};
          // Moves fromId → toId in a map; no-ops if fromId isn't present.
          const move = <T>(map: Record<string, T>): Record<string, T> => {
            if (!(fromId in map)) return map;
            const next = { ...map };
            next[toId] = next[fromId]!;
            delete next[fromId];
            return next;
          };
          return {
            draftBySession: move(s.draftBySession),
            pendingChatMessageBySession: move(s.pendingChatMessageBySession),
            pendingComposerSubmissionBySession: move(
              s.pendingComposerSubmissionBySession,
            ),
            pendingAttachmentsBySession: move(s.pendingAttachmentsBySession),
            pendingTagsBySession: move(s.pendingTagsBySession),
            sessionTitleOverrides: move(s.sessionTitleOverrides),
            streamingSessionIds: move(s.streamingSessionIds),
            requestedStopBySession: move(s.requestedStopBySession),
            sessionUsageById: move(s.sessionUsageById),
            summarizationMarkersById: move(s.summarizationMarkersById),
            selfCritiqueBySession: move(s.selfCritiqueBySession),
            selectedModelBySession: move(s.selectedModelBySession),
          };
        }),
    }),
    {
      name: "claude-design:workspace",
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
      partialize: (s) => ({
        activeSessionByProject: s.activeSessionByProject,
        openSessionsByProject: s.openSessionsByProject,
        defaultModelByProject: s.defaultModelByProject,
        selectedModelBySession: s.selectedModelBySession,
        openTabsByProject: s.openTabsByProject,
        activeTabByProject: s.activeTabByProject,
        chatPanelSize: s.chatPanelSize,
        zoom: s.zoom,
        selfCritiqueBySession: s.selfCritiqueBySession,
      }),
    },
  ),
);

export const DEFAULT_MODEL_OPTION = DEFAULT_MODEL;

/** Returns the active model for a session: session pick > project default > global default. */
export function resolveSessionModel(
  sessionId: string,
  projectId: string,
  store: Pick<
    WorkspaceState,
    "selectedModelBySession" | "defaultModelByProject"
  >,
) {
  return (
    store.selectedModelBySession[sessionId] ??
    store.defaultModelByProject[projectId]
  );
}
