"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ChatSessionDTO } from "@/lib/workspace/types";
import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import {
  createSession,
  deleteSession,
  renameSession,
} from "@/server/actions/sessions";
import { SessionHistoryList } from "./session-history-list";

interface SessionTabsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
}

export const TEMP_SESSION_PREFIX = "temp-session-";

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
  const [optimisticIds, setOptimisticIds] = React.useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null,
  );

  // Reconcile the persisted open-tab list with the server's source of truth.
  // - First visit: seed with the active session (or the first known one).
  // - Subsequent visits: prune ids that have been deleted server-side so we
  //   don't render dead tabs. Sessions the user explicitly closed stay closed.
  React.useEffect(() => {
    ensureHydrated(
      projectId,
      sessions.map((s) => s.id),
      activeSessionId,
    );
  }, [activeSessionId, ensureHydrated, projectId, sessions]);

  const removeFromDb = useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: () => router.refresh(),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to delete session"),
  });

  const requestDelete = React.useCallback((sessionId: string) => {
    setConfirmDeleteId(sessionId);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    const id = confirmDeleteId;
    if (!id) return;
    // Closing the tab first keeps the UI consistent if the network call
    // fails — the server-side session would still exist and reappear in the
    // History popover, but the user's tab strip stays predictable.
    closeSessionTab(projectId, id);
    await removeFromDb.mutateAsync(id);
    setConfirmDeleteId(null);
  }, [closeSessionTab, confirmDeleteId, projectId, removeFromDb]);

  const deletingSession = confirmDeleteId
    ? sessions.find((s) => s.id === confirmDeleteId)
    : null;

  // Synchronous guard against rapid-fire clicks. React state and Zustand
  // selectors don't reflect the click's effect until the next render, so a
  // stale `activeSessionId` closure would let multiple temp tabs pile up
  // before the first server response lands. A ref flips the moment we start.
  const creatingRef = React.useRef(false);

  const handleNew = React.useCallback(async () => {
    if (creatingRef.current) return;

    // Read the freshest active id directly from the store so we don't rely on
    // the prop closure, which is at least one render behind during spam clicks.
    const liveActiveId =
      useWorkspaceStore.getState().activeSessionByProject[projectId];

    // 1. Spam-click guard: if the user is already sitting on an empty session,
    //    don't stack another one. Same goes for an in-flight optimistic tab —
    //    that placeholder will resolve to a brand-new empty session in a moment.
    if (liveActiveId?.startsWith(TEMP_SESSION_PREFIX)) return;
    const activeSession = sessions.find((s) => s.id === liveActiveId);
    if (activeSession && activeSession.isEmpty) return;

    // 2. Cross-tab guard: if some other tab/window already created an empty
    //    session that we know about and it's currently visible in the strip,
    //    jump to it instead of creating another. We deliberately ignore empty
    //    sessions the user has closed (not in openSessionIds) — opening "New"
    //    should always feel like opening a fresh tab, not silently reviving a
    //    closed one. The server enforces dedupe too, but checking here avoids
    //    the round-trip.
    const openSet = new Set(openSessionIds);
    const reusableEmpty = sessions
      .filter((s) => s.isEmpty && openSet.has(s.id))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
    if (reusableEmpty) {
      setActive(projectId, reusableEmpty.id);
      return;
    }

    creatingRef.current = true;
    const tempId = `${TEMP_SESSION_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previousActive = liveActiveId;
    setOptimisticIds((prev) => [...prev, tempId]);
    setActive(projectId, tempId);
    try {
      const s = await createSession(projectId);
      // Atomically swap the placeholder for the real tab. Tying cleanup to the
      // server response (rather than to a `sessions.length` delta) is the only
      // way to handle the case where the server reused an existing empty
      // session — the array length never grew, so a length-based cleanup
      // would leave the placeholder stranded as a ghost tab.
      setOptimisticIds((prev) => prev.filter((id) => id !== tempId));
      setActive(projectId, s.id);
      queryClient.invalidateQueries({ queryKey: ["session-messages"] });
      router.refresh();
    } catch (e) {
      setOptimisticIds((prev) => prev.filter((id) => id !== tempId));
      if (previousActive && !previousActive.startsWith(TEMP_SESSION_PREFIX)) {
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

  const [historyOpen, setHistoryOpen] = React.useState(false);
  const handleSelectFromHistory = React.useCallback(
    (sessionId: string) => {
      openSessionTab(projectId, sessionId);
      setHistoryOpen(false);
    },
    [openSessionTab, projectId],
  );

  const optimisticSessions = React.useMemo<ChatSessionDTO[]>(
    () =>
      optimisticIds.map((id, i) => ({
        id,
        title: "New Session",
        order: sessions.length + i,
        updatedAt: new Date().toISOString(),
        isEmpty: true,
        usage: {
          cumulativeInputTokens: 0,
          cumulativeOutputTokens: 0,
          summarizedCount: 0,
          totalCostUsd: 0,
        },
      })),
    [optimisticIds, sessions.length],
  );

  // Render only the sessions the user has "open" as tabs. Closed sessions
  // remain in `sessions` (server source of truth) so they're discoverable
  // through the History popover, but they're filtered out of the strip.
  const displaySessions = React.useMemo(() => {
    const sessionById = new Map(sessions.map((s) => [s.id, s] as const));
    const openTabs = openSessionIds
      .map((id) => sessionById.get(id))
      .filter((s): s is ChatSessionDTO => Boolean(s));
    return [...openTabs, ...optimisticSessions].map((s) => {
      const override = titleOverrides[s.id];
      return override ? { ...s, title: override } : s;
    });
  }, [sessions, openSessionIds, optimisticSessions, titleOverrides]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });

  // Track which edges have hidden content so we can render fade masks. Toggled
  // (rather than per-pixel computed) because re-rendering on every scroll
  // event would be wasteful for a tab strip.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [displaySessions.length]);

  // Convert vertical mouse-wheel deltas into horizontal scroll so users without
  // a trackpad can navigate the strip without holding Shift. Trackpads already
  // emit deltaX, so we leave those events untouched.
  React.useEffect(() => {
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

  // Keep the active session in view when it changes (selection, new session,
  // or a server refresh that reorders tabs).
  React.useEffect(() => {
    if (!activeSessionId) return;
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `[data-session-id="${CSS.escape(activeSessionId)}"]`,
    );
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSessionId, displaySessions.length]);

  const FADE = 28;
  const maskImage = `linear-gradient(to right, transparent 0, black ${
    edges.left ? FADE : 0
  }px, black calc(100% - ${edges.right ? FADE : 0}px), transparent 100%)`;

  return (
    <div className="flex items-center gap-0.5 pl-2 py-1.5 mr-2">
      <div
        ref={scrollRef}
        className="scrollbar-hide flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        {displaySessions.map((s) => (
          <SessionTab
            key={s.id}
            session={s}
            active={s.id === activeSessionId}
            onSelect={() => setActive(projectId, s.id)}
            isPending={s.id.startsWith(TEMP_SESSION_PREFIX)}
            onClose={() => closeSessionTab(projectId, s.id)}
            onDelete={() => requestDelete(s.id)}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-surface-sunken">
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
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
              onSelect={handleSelectFromHistory}
            />
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              aria-label="New session"
              className="size-7 shrink-0 hover:bg-border"
              icon={<Plus className="size-3.5" />}
              onClick={handleNew}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">New session</TooltipContent>
        </Tooltip>
      </div>
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
    </div>
  );
}

interface SessionTabProps {
  session: ChatSessionDTO;
  active: boolean;
  onSelect: () => void;
  isPending: boolean;
  onClose: () => void;
  onDelete: () => void;
}

function SessionTab({
  session,
  active,
  onSelect,
  isPending,
  onClose,
  onDelete,
}: SessionTabProps) {
  const [renaming, setRenaming] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState(session.title);
  const router = useRouter();
  const isStreaming = useWorkspaceStore(
    (s) => Boolean(s.streamingSessionIds[session.id]),
  );

  const rename = useMutation({
    mutationFn: (title: string) => renameSession(session.id, title),
    onSuccess: () => {
      setRenaming(false);
      router.refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to rename"),
  });

  const tabClasses = cn(
    "group inline-flex h-7 max-w-[160px] shrink-0 cursor-pointer items-center gap-1 rounded-md pl-2 pr-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-surface-sunken text-ink"
      : "text-ink-muted hover:bg-surface-sunken/60 hover:text-ink",
  );

  // Optimistic placeholder tabs are non-interactive beyond selection — they
  // can't be renamed or closed until the server has assigned a real ID.
  if (isPending) {
    return (
      <button
        type="button"
        onClick={onSelect}
        data-session-id={session.id}
        className={cn(tabClasses, "pr-2")}
      >
        <span className="truncate">{session.title}</span>
      </button>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          data-session-id={session.id}
          onClick={onSelect}
          onDoubleClick={() => setRenaming(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          className={tabClasses}
        >
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label="Agent is working"
                  className="relative inline-flex size-1.5 shrink-0 items-center justify-center"
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Agent is working</TooltipContent>
            </Tooltip>
          ) : null}
          {renaming ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => rename.mutate(draftTitle)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") rename.mutate(draftTitle);
                if (e.key === "Escape") {
                  setDraftTitle(session.title);
                  setRenaming(false);
                }
              }}
              className="w-24 bg-transparent text-xs outline-none"
            />
          ) : (
            <span className="truncate">{session.title}</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label={`Close ${session.title}`}
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded transition-opacity hover:bg-border",
              active
                ? "opacity-60 hover:opacity-100"
                : "opacity-0 group-hover:opacity-60 hover:opacity-100",
            )}
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => setRenaming(true)}>
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={onClose}>
          <X className="size-3.5" />
          Close tab
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onDelete}
        >
          Delete session
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
