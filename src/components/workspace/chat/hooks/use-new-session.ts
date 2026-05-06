"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ChatSessionDTO, SessionUsage } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { createSession } from "@/server/actions/sessions";
import { TEMP_SESSION_PREFIX } from "@/components/workspace/chat/utils/session-constants";

const EMPTY_USAGE: SessionUsage = {
  currentInputTokens: 0,
  lifetimeFoldedTokens: 0,
  lifetimeOutputTokens: 0,
  summarizedCount: 0,
  totalCostUsd: 0,
};

type StoreSnapshot = Pick<
  ReturnType<typeof useWorkspaceStore.getState>,
  "draftBySession" | "pendingAttachmentsBySession" | "pendingTagsBySession" | "streamingSessionIds"
>;

function isSessionBusy(sessionId: string, state: StoreSnapshot): boolean {
  return (
    (state.draftBySession[sessionId] ?? "").trim().length > 0 ||
    (state.pendingAttachmentsBySession[sessionId] ?? []).length > 0 ||
    (state.pendingTagsBySession[sessionId] ?? []).length > 0 ||
    Boolean(state.streamingSessionIds[sessionId])
  );
}

export function useNewSession(
  projectId: string,
  sessions: ChatSessionDTO[],
  openSessionIds: string[],
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setActive = useWorkspaceStore((s) => s.setActiveSession);
  const ensureHydrated = useWorkspaceStore((s) => s.ensureSessionTabsHydrated);

  const [pendingSessions, setPendingSessions] = useState<ChatSessionDTO[]>([]);

  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const protectedIds = useMemo(() => pendingSessions.map((s) => s.id), [pendingSessions]);

  // Reconcile the persisted open-tab list with the server's source of truth.
  useEffect(() => {
    ensureHydrated(projectId, sessionIds, protectedIds);
  }, [ensureHydrated, projectId, sessionIds, protectedIds]);

  // Drop pending entries once the server-rendered sessions prop catches up.
  useEffect(() => {
    if (pendingSessions.length === 0) return;
    const known = new Set(sessionIds);
    const next = pendingSessions.filter((s) => !known.has(s.id));
    if (next.length !== pendingSessions.length) setPendingSessions(next);
  }, [pendingSessions, sessionIds]);

  const creatingRef = useRef(false);

  const handleNew = useCallback(async () => {
    if (creatingRef.current) return;

    const storeState = useWorkspaceStore.getState();
    const liveActiveId = storeState.activeSessionByProject[projectId];

    if (liveActiveId?.startsWith(TEMP_SESSION_PREFIX)) return;

    // Don't open a new tab when the active session is already empty and idle.
    const activeSession = sessions.find((s) => s.id === liveActiveId);
    if (activeSession?.isEmpty && liveActiveId && !isSessionBusy(liveActiveId, storeState)) {
      return;
    }

    // Re-use the most recent empty session if it has nothing pending.
    // (sessions is sorted createdAt asc, so last entry is most recent.)
    const mostRecentSession = sessions[sessions.length - 1];
    if (mostRecentSession?.isEmpty && !isSessionBusy(mostRecentSession.id, storeState)) {
      setActive(projectId, mostRecentSession.id);
      return;
    }

    creatingRef.current = true;
    const tempId = `${TEMP_SESSION_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previousActive = liveActiveId;

    setPendingSessions((prev) => [
      ...prev,
      { id: tempId, title: "New Session", updatedAt: new Date().toISOString(), isEmpty: true, usage: EMPTY_USAGE },
    ]);
    setActive(projectId, tempId);

    try {
      const s = await createSession(projectId);
      setPendingSessions((prev) => [
        ...prev.filter((p) => p.id !== tempId),
        { id: s.id, title: s.title, updatedAt: s.updatedAt, isEmpty: s.isEmpty, usage: EMPTY_USAGE },
      ]);
      useWorkspaceStore.getState().migrateSessionState(tempId, s.id);
      queryClient.setQueryData(["session-messages", s.id], []);
      setActive(projectId, s.id);
      toast.success("New session created");
      router.refresh();
    } catch (e) {
      setPendingSessions((prev) => prev.filter((p) => p.id !== tempId));
      const fallbackId =
        previousActive && !previousActive.startsWith(TEMP_SESSION_PREFIX)
          ? previousActive
          : openSessionIds.find((id) => sessions.some((s) => s.id === id));
      if (fallbackId) setActive(projectId, fallbackId);
      toast.error(e instanceof Error ? e.message : "Failed to create session");
    } finally {
      creatingRef.current = false;
    }
  }, [openSessionIds, projectId, queryClient, router, sessions, setActive]);

  // Auto-open when there are zero open tabs. Prefer restoring the most recently
  // updated session over creating a new empty one, so returning users see their
  // history instead of a blank chat.
  useEffect(() => {
    if (pendingSessions.length > 0) return;
    if (creatingRef.current) return;
    const liveOpen = useWorkspaceStore.getState().openSessionsByProject[projectId] ?? [];
    if (liveOpen.length > 0) return;

    const storeState = useWorkspaceStore.getState();
    const sessionToRestore = [...sessions]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .find((s) => !isSessionBusy(s.id, storeState));

    if (sessionToRestore) {
      setActive(projectId, sessionToRestore.id);
    } else {
      void handleNew();
    }
  }, [openSessionIds.length, pendingSessions.length, projectId, sessions, setActive, handleNew]);

  return { pendingSessions, handleNew };
}
