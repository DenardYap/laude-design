"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import type { ChatSessionDTO } from "@/lib/workspace/types";
import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import { createSession, deleteSession } from "@/server/actions/sessions";
import { SessionHistoryList } from "@/components/workspace/chat/session-history-list";
import { SessionTab } from "@/components/workspace/chat/session-tab";
import { useTabDrag } from "@/components/workspace/chat/hooks/use-tab-drag";
import { useScrollEdges } from "@/components/workspace/chat/hooks/use-scroll-edges";

interface SessionTabsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
}

export const TEMP_SESSION_PREFIX = "temp-session-";

// ---------------------------------------------------------------------------
// SessionTabStrip — horizontally scrollable tab list with fade masks
// ---------------------------------------------------------------------------

interface SessionTabStripProps {
  displaySessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
  dragOffset: { tabId: string; offset: number } | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  maskImage: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  registerTabEl: (id: string) => (el: HTMLDivElement | null) => void;
  onTabMouseDown: (id: string, e: React.MouseEvent<HTMLDivElement>) => void;
}

function SessionTabStrip({
  displaySessions,
  activeSessionId,
  dragOffset,
  scrollRef,
  maskImage,
  onSelect,
  onClose,
  onDelete,
  registerTabEl,
  onTabMouseDown,
}: SessionTabStripProps) {
  return (
    <div
      ref={scrollRef}
      className="scrollbar-hide flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
      style={{ maskImage, WebkitMaskImage: maskImage }}
    >
      {displaySessions.map((s) => {
        const isPending = s.id.startsWith(TEMP_SESSION_PREFIX);
        const isDragging = dragOffset?.tabId === s.id;
        return (
          <SessionTab
            key={s.id}
            session={s}
            active={s.id === activeSessionId}
            onSelect={() => onSelect(s.id)}
            isPending={isPending}
            onClose={() => onClose(s.id)}
            onDelete={() => onDelete(s.id)}
            isDragging={isDragging}
            dragOffset={isDragging ? (dragOffset?.offset ?? 0) : 0}
            tabRef={isPending ? undefined : registerTabEl(s.id)}
            onMouseDown={
              isPending ? undefined : (e) => onTabMouseDown(s.id, e)
            }
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionTabActions — history popover + new-session button
// ---------------------------------------------------------------------------

interface SessionTabActionsProps {
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onSelectFromHistory: (id: string) => void;
  onDeleteFromHistory: (id: string) => void;
  onNew: () => void;
}

function SessionTabActions({
  sessions,
  activeSessionId,
  historyOpen,
  onHistoryOpenChange,
  onSelectFromHistory,
  onDeleteFromHistory,
  onNew,
}: SessionTabActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-surface-sunken">
      <Popover open={historyOpen} onOpenChange={onHistoryOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <IconButton
                aria-label="Session history"
                className="size-7 shrink-0 hover:bg-border"
                icon={<History className="size-3.5" />}
              />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">All sessions</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
          <SessionHistoryList
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={onSelectFromHistory}
            onDelete={onDeleteFromHistory}
          />
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New session"
            className="size-7 shrink-0 hover:bg-border"
            icon={<Plus className="size-3.5" />}
            onClick={onNew}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New session</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionTabs — public API
// ---------------------------------------------------------------------------

export function SessionTabs({
  projectId,
  sessions,
  activeSessionId,
}: SessionTabsProps) {
  const router = useRouter();
  const setActive = useWorkspaceStore((s) => s.setActiveSession);
  const closeSessionTab = useWorkspaceStore((s) => s.closeSessionTab);
  const openSessionTab = useWorkspaceStore((s) => s.openSessionTab);
  const ensureHydrated = useWorkspaceStore((s) => s.ensureSessionTabsHydrated);
  const openSessionIds = useWorkspaceStore(
    (s) => s.openSessionsByProject[projectId] ?? EMPTY_TAB_LIST,
  );
  const titleOverrides = useWorkspaceStore((s) => s.sessionTitleOverrides);
  const queryClient = useQueryClient();

  const [pendingSessions, setPendingSessions] = useState<ChatSessionDTO[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmStopCloseId, setConfirmStopCloseId] = useState<string | null>(
    null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  const requestSessionStop = useWorkspaceStore((s) => s.requestSessionStop);
  const streamingSessionIds = useWorkspaceStore((s) => s.streamingSessionIds);

  // Reconcile the persisted open-tab list with the server's source of truth.
  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const protectedIds = useMemo(
    () => pendingSessions.map((s) => s.id),
    [pendingSessions],
  );
  useEffect(() => {
    ensureHydrated(projectId, sessionIds, protectedIds);
  }, [ensureHydrated, projectId, sessionIds, protectedIds]);

  // Drop pending entries once the server-rendered `sessions` prop catches up.
  useEffect(() => {
    if (pendingSessions.length === 0) return;
    const known = new Set(sessionIds);
    const next = pendingSessions.filter((s) => !known.has(s.id));
    if (next.length !== pendingSessions.length) setPendingSessions(next);
  }, [pendingSessions, sessionIds]);

  const removeFromDb = useMutation({
    mutationFn: async (sessionId: string) => {
      const title =
        sessions.find((s) => s.id === sessionId)?.title ?? "Session";
      await deleteSession(sessionId);
      return title;
    },
    onSuccess: (title) => {
      toast.success(`Deleted "${title}"`);
      router.refresh();
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Failed to delete session",
      ),
  });

  const requestDelete = useCallback((sessionId: string) => {
    setConfirmDeleteId(sessionId);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const id = confirmDeleteId;
    if (!id) return;
    closeSessionTab(projectId, id);
    await removeFromDb.mutateAsync(id);
    setConfirmDeleteId(null);
  }, [closeSessionTab, confirmDeleteId, projectId, removeFromDb]);

  const handleCloseTab = useCallback(
    (sessionId: string) => {
      if (streamingSessionIds[sessionId]) {
        setConfirmStopCloseId(sessionId);
      } else {
        closeSessionTab(projectId, sessionId);
      }
    },
    [closeSessionTab, projectId, streamingSessionIds],
  );

  const handleConfirmStopClose = useCallback(() => {
    const id = confirmStopCloseId;
    if (!id) return;
    requestSessionStop(id);
    closeSessionTab(projectId, id);
    setConfirmStopCloseId(null);
  }, [closeSessionTab, confirmStopCloseId, projectId, requestSessionStop]);

  const deletingSession = confirmDeleteId
    ? sessions.find((s) => s.id === confirmDeleteId)
    : null;

  // Synchronous guard against rapid-fire clicks.
  const creatingRef = useRef(false);

  const handleNew = useCallback(async () => {
    if (creatingRef.current) return;

    const storeState = useWorkspaceStore.getState();
    const liveActiveId = storeState.activeSessionByProject[projectId];

    if (liveActiveId?.startsWith(TEMP_SESSION_PREFIX)) return;
    const activeSession = sessions.find((s) => s.id === liveActiveId);
    if (activeSession && activeSession.isEmpty && liveActiveId) {
      const hasDraft =
        (storeState.draftBySession[liveActiveId] ?? "").trim().length > 0;
      const hasPendingAttachments =
        (storeState.pendingAttachmentsBySession[liveActiveId] ?? []).length > 0;
      const hasPendingTags =
        (storeState.pendingTagsBySession[liveActiveId] ?? []).length > 0;
      const isStreaming = Boolean(
        storeState.streamingSessionIds[liveActiveId],
      );
      if (!hasDraft && !hasPendingAttachments && !hasPendingTags && !isStreaming) {
        return;
      }
    }

    creatingRef.current = true;
    const tempId = `${TEMP_SESSION_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previousActive = liveActiveId;
    const tempEntry: ChatSessionDTO = {
      id: tempId,
      title: "New Session",
      updatedAt: new Date().toISOString(),
      isEmpty: true,
      usage: {
        currentInputTokens: 0,
        lifetimeFoldedTokens: 0,
        lifetimeOutputTokens: 0,
        summarizedCount: 0,
        totalCostUsd: 0,
      },
    };
    setPendingSessions((prev) => [...prev, tempEntry]);
    setActive(projectId, tempId);
    try {
      const s = await createSession(projectId);
      setPendingSessions((prev) => [
        ...prev.filter((p) => p.id !== tempId),
        {
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          isEmpty: s.isEmpty,
          usage: {
            currentInputTokens: 0,
            lifetimeFoldedTokens: 0,
            lifetimeOutputTokens: 0,
            summarizedCount: 0,
            totalCostUsd: 0,
          },
        },
      ]);
      useWorkspaceStore.getState().migrateSessionState(tempId, s.id);
      queryClient.setQueryData(["session-messages", s.id], []);
      setActive(projectId, s.id);
      toast.success("New session created");
      router.refresh();
    } catch (e) {
      setPendingSessions((prev) => prev.filter((p) => p.id !== tempId));
      if (
        previousActive &&
        !previousActive.startsWith(TEMP_SESSION_PREFIX)
      ) {
        setActive(projectId, previousActive);
      } else {
        const firstOpen = openSessionIds.find((id) =>
          sessions.some((s) => s.id === id),
        );
        if (firstOpen) setActive(projectId, firstOpen);
      }
      toast.error(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      creatingRef.current = false;
    }
  }, [openSessionIds, projectId, queryClient, router, sessions, setActive]);

  // Auto-open a fresh session when there are zero open tabs.
  useEffect(() => {
    if (pendingSessions.length > 0) return;
    if (creatingRef.current) return;
    const liveOpen =
      useWorkspaceStore.getState().openSessionsByProject[projectId] ?? [];
    if (liveOpen.length > 0) return;
    void handleNew();
  }, [openSessionIds.length, pendingSessions.length, projectId, handleNew]);

  const handleSelectFromHistory = useCallback(
    (sessionId: string) => {
      openSessionTab(projectId, sessionId);
      setHistoryOpen(false);
    },
    [openSessionTab, projectId],
  );
  const handleDeleteFromHistory = useCallback(
    (sessionId: string) => {
      setHistoryOpen(false);
      requestDelete(sessionId);
    },
    [requestDelete],
  );

  const sessionsById = useMemo(() => {
    const map = new Map<string, ChatSessionDTO>();
    for (const s of sessions) map.set(s.id, s);
    for (const s of pendingSessions) {
      if (!map.has(s.id)) map.set(s.id, s);
    }
    return map;
  }, [sessions, pendingSessions]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { renderOrder, dragOffset, handleTabMouseDown, registerTabEl } =
    useTabDrag(openSessionIds, projectId, scrollRef);

  const displaySessions = useMemo(() => {
    return renderOrder
      .map((id) => sessionsById.get(id))
      .filter((s): s is ChatSessionDTO => Boolean(s))
      .map((s) => {
        const override = titleOverrides[s.id];
        return override ? { ...s, title: override } : s;
      });
  }, [renderOrder, sessionsById, titleOverrides]);

  // Keep the active session in view when it changes.
  useEffect(() => {
    if (!activeSessionId) return;
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `[data-session-id="${CSS.escape(activeSessionId)}"]`,
    );
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSessionId, displaySessions.length]);

  // Convert vertical scroll to horizontal so non-trackpad users can navigate.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX === 0 && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const edges = useScrollEdges(scrollRef, [displaySessions.length]);
  const FADE = 28;
  const maskImage = `linear-gradient(to right, transparent 0, black ${
    edges.left ? FADE : 0
  }px, black calc(100% - ${edges.right ? FADE : 0}px), transparent 100%)`;

  return (
    <div className="flex items-center gap-0.5 pl-2 py-1.5 mr-2">
      <SessionTabStrip
        displaySessions={displaySessions}
        activeSessionId={activeSessionId}
        dragOffset={dragOffset}
        scrollRef={scrollRef}
        maskImage={maskImage}
        onSelect={(id) => setActive(projectId, id)}
        onClose={handleCloseTab}
        onDelete={requestDelete}
        registerTabEl={registerTabEl}
        onTabMouseDown={handleTabMouseDown}
      />
      <SessionTabActions
        sessions={sessions}
        activeSessionId={activeSessionId}
        historyOpen={historyOpen}
        onHistoryOpenChange={setHistoryOpen}
        onSelectFromHistory={handleSelectFromHistory}
        onDeleteFromHistory={handleDeleteFromHistory}
        onNew={handleNew}
      />
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title="Delete this session?"
        description={
          deletingSession
            ? `"${deletingSession.title}" and its chat history will be permanently removed. This can't be undone.`
            : "This session and its chat history will be permanently removed. This can't be undone."
        }
        confirmLabel="Delete session"
        tone="destructive"
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={confirmStopCloseId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmStopCloseId(null);
        }}
        title="Stop and close this session?"
        description="The agent is still working. Closing the tab will abort the in-flight turn."
        confirmLabel="Stop and close"
        cancelLabel="Keep open"
        tone="destructive"
        onConfirm={handleConfirmStopClose}
      />
    </div>
  );
}
