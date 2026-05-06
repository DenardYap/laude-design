"use client";

import { useMemo } from "react";

import { ConfirmDialog } from "@/components/ui";
import type { ChatSessionDTO } from "@/lib/workspace/types";
import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import { SessionTabStrip } from "@/components/workspace/chat/session-tab-strip";
import { SessionTabActions } from "@/components/workspace/chat/session-tab-actions";
import { useNewSession } from "@/components/workspace/chat/hooks/use-new-session";
import { useSessionDelete } from "@/components/workspace/chat/hooks/use-session-delete";
import { useSessionClose } from "@/components/workspace/chat/hooks/use-session-close";
import type { SessionTabsProps } from "@/components/workspace/chat/types/session";

export { TEMP_SESSION_PREFIX } from "@/components/workspace/chat/utils/session-constants";

export function SessionTabs({ projectId, sessions }: SessionTabsProps) {
  const openSessionIds = useWorkspaceStore(
    (s) => s.openSessionsByProject[projectId] ?? EMPTY_TAB_LIST,
  );
  const deleteConfirmSessionId = useWorkspaceStore((s) => s.deleteConfirmSessionId);
  const clearSessionDeleteConfirm = useWorkspaceStore((s) => s.clearSessionDeleteConfirm);
  const stopCloseConfirm = useWorkspaceStore((s) => s.stopCloseConfirm);
  const clearStopCloseConfirm = useWorkspaceStore((s) => s.clearStopCloseConfirm);

  const { pendingSessions, handleNew } = useNewSession(projectId, sessions, openSessionIds);
  const { handleConfirmDelete, deletingSession } = useSessionDelete(projectId, sessions);
  const { handleConfirmStopClose } = useSessionClose();

  const sessionsById = useMemo(() => {
    const map = new Map<string, ChatSessionDTO>();
    for (const s of sessions) map.set(s.id, s);
    for (const s of pendingSessions) {
      if (!map.has(s.id)) map.set(s.id, s);
    }
    return map;
  }, [sessions, pendingSessions]);

  return (
    <div className="flex items-center gap-0.5 pl-2 py-1.5 mr-2">
      <SessionTabStrip projectId={projectId} sessionsById={sessionsById} />
      <SessionTabActions projectId={projectId} sessions={sessions} onNew={handleNew} />
      <ConfirmDialog
        open={deleteConfirmSessionId !== null}
        onOpenChange={(open) => { if (!open) clearSessionDeleteConfirm(); }}
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
        open={stopCloseConfirm !== null}
        onOpenChange={(open) => { if (!open) clearStopCloseConfirm(); }}
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
