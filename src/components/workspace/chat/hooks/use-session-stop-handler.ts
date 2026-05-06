"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

/**
 * Responds to stop requests dispatched via the workspace store,
 * calling `stop()` on the active useChat instance and clearing the flag.
 */
export function useSessionStopHandler(sessionId: string, stop: () => void) {
  const stopRequested = useWorkspaceStore((s) => Boolean(s.requestedStopBySession[sessionId]));
  const clearSessionStop = useWorkspaceStore((s) => s.clearSessionStop);

  useEffect(() => {
    if (!stopRequested) return;
    void stop();
    clearSessionStop(sessionId);
  }, [stopRequested, stop, clearSessionStop, sessionId]);
}
