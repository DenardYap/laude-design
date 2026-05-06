"use client";

import { useEffect } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { ChatError } from "@/components/workspace/chat/utils/chat-errors";
import { useWorkspaceStore } from "@/stores/workspace-store";

type SendMessage = UseChatHelpers<UIMessage>["sendMessage"];

/**
 * Bridges Zustand-enqueued messages and composer submissions into the active
 * useChat instance. Consumed immediately after reading to prevent double-sends.
 */
export function useSessionMessageBridge(
  sessionId: string,
  sendMessage: SendMessage,
  setChatError: (error: ChatError | null) => void,
) {
  const pendingMessage = useWorkspaceStore((s) => s.pendingChatMessageBySession[sessionId]);
  const consumeChatMessage = useWorkspaceStore((s) => s.consumeChatMessage);
  const pendingSubmission = useWorkspaceStore(
    (s) => s.pendingComposerSubmissionBySession[sessionId],
  );
  const consumeComposerSubmission = useWorkspaceStore((s) => s.consumeComposerSubmission);

  useEffect(() => {
    if (!pendingMessage) return;
    setChatError(null);
    void sendMessage({ text: pendingMessage });
    consumeChatMessage(sessionId);
  }, [pendingMessage, sendMessage, consumeChatMessage, sessionId, setChatError]);

  useEffect(() => {
    if (!pendingSubmission) return;
    setChatError(null);
    void sendMessage({ parts: pendingSubmission });
    consumeComposerSubmission(sessionId);
  }, [pendingSubmission, sendMessage, consumeComposerSubmission, sessionId, setChatError]);
}
