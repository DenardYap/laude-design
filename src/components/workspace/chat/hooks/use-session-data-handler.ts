"use client";

import { useCallback } from "react";
import type { RefObject } from "react";
import type { UIMessage, ChatOnDataCallback } from "ai";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface SessionUsagePayload {
  sessionId: string;
  currentInputTokens: number;
  lifetimeFoldedTokens: number;
  lifetimeOutputTokens: number;
  summarizedCount: number;
  totalCostUsd: number;
  justSummarized: boolean;
}

/**
 * Returns a stable `onData` callback for useChat that handles the two
 * server-streamed data events: session title updates and token-usage updates.
 */
export function useSessionDataHandler(
  messagesRef: RefObject<UIMessage[]>,
): ChatOnDataCallback<UIMessage> {
  const setSessionTitleOverride = useWorkspaceStore((s) => s.setSessionTitleOverride);
  const setSessionUsage = useWorkspaceStore((s) => s.setSessionUsage);
  const addSummarizationMarker = useWorkspaceStore((s) => s.addSummarizationMarker);

  return useCallback(
    (part) => {
      if (part.type === "data-session-title") {
        const payload = part.data as { sessionId: string; title: string };
        if (payload?.sessionId && payload.title) {
          setSessionTitleOverride(payload.sessionId, payload.title);
        }
      }

      if (part.type === "data-session-usage") {
        const payload = part.data as SessionUsagePayload;
        if (!payload?.sessionId) return;

        setSessionUsage(payload.sessionId, {
          currentInputTokens: payload.currentInputTokens,
          lifetimeFoldedTokens: payload.lifetimeFoldedTokens,
          lifetimeOutputTokens: payload.lifetimeOutputTokens,
          summarizedCount: payload.summarizedCount,
          totalCostUsd: payload.totalCostUsd,
        });

        if (payload.justSummarized) {
          const idx = Math.max(0, (messagesRef.current?.length ?? 1) - 1);
          addSummarizationMarker(payload.sessionId, idx);
        }
      }
    },
    [setSessionTitleOverride, setSessionUsage, addSummarizationMarker, messagesRef],
  );
}
