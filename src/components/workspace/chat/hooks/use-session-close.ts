"use client";

import { useCallback } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function useSessionClose() {
  const requestSessionStop = useWorkspaceStore((s) => s.requestSessionStop);
  const closeSessionTab = useWorkspaceStore((s) => s.closeSessionTab);
  const stopCloseConfirm = useWorkspaceStore((s) => s.stopCloseConfirm);
  const clearStopCloseConfirm = useWorkspaceStore((s) => s.clearStopCloseConfirm);

  const handleConfirmStopClose = useCallback(() => {
    if (!stopCloseConfirm) return;
    const { sessionId, projectId } = stopCloseConfirm;
    requestSessionStop(sessionId);
    closeSessionTab(projectId, sessionId);
    clearStopCloseConfirm();
  }, [clearStopCloseConfirm, closeSessionTab, requestSessionStop, stopCloseConfirm]);

  return { handleConfirmStopClose };
}
