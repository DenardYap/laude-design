"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

/**
 * Keeps the workspace store's streaming flag in sync with the local useChat
 * status so the global Composer can flip its Send button to a Stop button.
 */
export function useSessionStreamingSync(sessionId: string, isStreaming: boolean) {
  const setSessionStreaming = useWorkspaceStore((s) => s.setSessionStreaming);

  useEffect(() => {
    setSessionStreaming(sessionId, isStreaming);
  }, [isStreaming, sessionId, setSessionStreaming]);

  useEffect(() => {
    return () => setSessionStreaming(sessionId, false);
  }, [sessionId, setSessionStreaming]);
}
