"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import { MODEL_OPTIONS } from "@/lib/workspace/types";
import type { ChatSessionDTO, SessionUsage } from "@/lib/workspace/types";
import type { UploadedFile } from "@/lib/api/uploads";
import type { TagMarker } from "@/lib/workspace/tag-markers";

/**
 * Rich message parts assembled by the global Composer and waiting to be
 * picked up by the matching `ActiveSession`'s `useChat`. Mirrors the AI
 * SDK's `UIMessagePart` shape so the consumer can hand it directly to
 * `sendMessage({ parts })`.
 */
export type PendingComposerSubmission = UIMessagePart<UIDataTypes, UITools>[];

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

export interface WorkspaceState {
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
    // Ids the caller knows are valid even though they're not in
    // `knownSessionIds` yet — e.g. an optimistic temp tab, or a real session
    // that was just created server-side but hasn't shown up in the next
    // server-render of `sessions`. These are NEVER pruned and NEVER trigger
    // an active-session rewrite. Without this, hydration races with optimistic
    // creates and would jump the user to the first persisted tab.
    protectedSessionIds?: ReadonlyArray<string>,
  ) => void;

  // Project-level sticky default: updated whenever the user changes the model
  // in any session. New sessions in this project inherit this value.
  defaultModelByProject: Record<string, { provider: string; modelId: string } | undefined>;

  // Per-session model selection. Seeded from `defaultModelByProject` when a
  // new session is opened (see `seedSessionModel`). Changing the model in one
  // session never touches sibling sessions.
  selectedModelBySession: Record<string, { provider: string; modelId: string } | undefined>;

  // Set the model for a specific session. Also updates the project-level
  // default so subsequent new sessions pick up the change.
  setSelectedModel: (projectId: string, sessionId: string, modelId: string, provider: string) => void;

  // Copy the current project default into a session the first time it's
  // opened, so the session has an explicit model value from the start.
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
  /**
   * Reconcile persisted canvas-tab state against the server's current design
   * list. Called on mount by CanvasTabStrip once the server-rendered `designs`
   * prop is available:
   *  - Prunes deleted design IDs from `openTabsByProject`.
   *  - If `activeTabByProject` points to a design that no longer exists,
   *    resets it to "files".
   */
  ensureCanvasTabsHydrated: (
    projectId: string,
    knownDesignIds: string[],
  ) => void;

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

  // Rich submissions assembled by the global Composer (text + attachments +
  // tag markers as `parts`). The Composer enqueues here keyed by whichever
  // session the user was looking at when they pressed Send; the matching
  // session's `useChat` watches its own slot and consumes. This indirection
  // is what lets the Composer live OUTSIDE any individual ActiveSession and
  // still drive its sendMessage — and crucially, lets a submission survive
  // a temp→real session id swap (the migration action below moves the
  // queued parts along with drafts/attachments/etc).
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

  // Side-channel for "close tab while streaming" confirmation. The session
  // tabs component writes a request here after the user confirms; the mounted
  // ActiveSession reads it, calls stop(), then clears it. Runtime-only.
  requestedStopBySession: Record<string, true>;
  requestSessionStop: (sessionId: string) => void;
  clearSessionStop: (sessionId: string) => void;

  // Cumulative usage stats for the chatbox indicator (tokens used, summaries,
  // and dollar cost). Hydrated from the server on mount via
  // `hydrateSessionUsage`, then patched live as each turn finishes via the
  // `data-session-usage` stream part. Persisted to DB by the chat route, so
  // these values survive reload — `hydrateSessionUsage` rewrites the map on
  // every workspace mount.
  sessionUsageById: Record<string, SessionUsage>;
  hydrateSessionUsage: (sessions: ChatSessionDTO[]) => void;
  setSessionUsage: (sessionId: string, usage: SessionUsage) => void;

  // Message-index positions in each session where rolling summarization fired.
  // Keyed by sessionId; each value is a sorted list of 0-based message indices
  // (the last message index present when the summarization completed).
  // Runtime-only — not persisted; historical summarizations (before this
  // page load) are surfaced via summarizedCount in the popover instead.
  summarizationMarkersById: Record<string, number[]>;
  addSummarizationMarker: (sessionId: string, messageIndex: number) => void;

  // Self-critique mode toggle per session. When on, the agent screenshots its
  // own design after each implementation pass, critiques it against the user
  // request and design taste, and revises (capped at 3 rounds). Off by
  // default — the toggle lives in the composer toolbar. Persisted so it
  // survives reload, but scoped per-session so flipping it on for one chat
  // doesn't leak into a sibling.
  selfCritiqueBySession: Record<string, boolean>;
  setSelfCritique: (sessionId: string, enabled: boolean) => void;

  /**
   * Runtime-only flag — true once the Zustand persist middleware has finished
   * reading from localStorage. Until this flips, any value read from the store
   * may be the SSR / JS-initialisation default, not the user's last persisted
   * state. Never persisted itself (it is always false on a fresh page load and
   * only set to true inside `onRehydrateStorage`).
   */
  _hasHydrated: boolean;
  _setHasHydrated: (v: boolean) => void;

  // Atomically reassign every per-session record from `fromId` to `toId`.
  // Called when an optimistic temp session id is swapped for the real
  // server-assigned id mid-create, so anything the user already typed,
  // attached, queued, or toggled on the temp tab transfers seamlessly to
  // the real session. Without this, the global Composer (bound to the
  // active session id) would appear to "blank out" the moment handleNew
  // flips the active id from temp to real.
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
      ensureSessionTabsHydrated: (projectId, knownSessionIds, protectedSessionIds) =>
        set((s) => {
          const known = new Set(knownSessionIds);
          const protectedSet = new Set(protectedSessionIds ?? []);
          // Treat protected ids as "valid" for hydration purposes — they're
          // in-flight optimistic placeholders or freshly created sessions
          // that the server-rendered `sessions` list hasn't caught up to yet.
          const isValid = (id: string) => known.has(id) || protectedSet.has(id);
          const existing = s.openSessionsByProject[projectId];
          const activeId = s.activeSessionByProject[projectId];
          // First visit (no persisted entry yet): leave open list empty so
          // the zero-tab auto-open effect in SessionTabs fires handleNew()
          // and creates a fresh session. This ensures the user always lands
          // on a new blank chat rather than an arbitrary existing session
          // when there is no localStorage state for this project.
          // On subsequent visits, only prune ids that no longer exist
          // server-side so we don't surprise the user by re-opening tabs
          // they explicitly closed.
          if (!existing) {
            return {
              openSessionsByProject: {
                ...s.openSessionsByProject,
                [projectId]: [],
              },
            };
          }
          const pruned = existing.filter(isValid);
          // Even if `existing` matches `pruned`, the persisted active session
          // may now be stale (deleted server-side). Drop it so chat-pane
          // doesn't try to fetch messages for a dead id.
          //
          // When the active session is gone, default to undefined ("new chat")
          // rather than silently jumping the user to a different open tab.
          const activeNext =
            activeId && isValid(activeId) ? activeId : undefined;
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

      requestedStopBySession: {},
      requestSessionStop: (sessionId) =>
        set((s) => ({
          requestedStopBySession: { ...s.requestedStopBySession, [sessionId]: true },
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
          // Pure helper: copy `fromId` → `toId` and drop `fromId`. Returns
          // the same reference if the source key is absent so we don't churn
          // identities for unrelated maps.
          const move = <T,>(map: Record<string, T>): Record<string, T> => {
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

/**
 * Resolves the effective model for a session.
 * Priority: session-specific selection > project default > global default.
 */
export function resolveSessionModel(
  sessionId: string,
  projectId: string,
  store: Pick<WorkspaceState, "selectedModelBySession" | "defaultModelByProject">,
) {
  return store.selectedModelBySession[sessionId] ?? store.defaultModelByProject[projectId];
}
