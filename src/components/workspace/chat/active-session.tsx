"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import type { ActiveSessionProps } from "@/components/workspace/chat/types/messages";

import { resolveModelOption } from "@/lib/workspace/types";
import {
  useWorkspaceStore,
  resolveSessionModel,
} from "@/stores/workspace-store";
import { MessageList } from "@/components/workspace/chat/message-list";
import {
  type ChatError,
  parseChatError,
} from "@/components/workspace/chat/utils/chat-errors";
import { useActiveDesignId } from "@/components/workspace/chat/hooks/use-active-design";
import { captureDesignScreenshot } from "@/components/workspace/canvas/capture-design";

/**
 * Custom continuation predicate: behaves identically to
 * `lastAssistantMessageIsCompleteWithToolCalls` EXCEPT when the last
 * assistant turn called `askClarifyingQuestions`. That tool pauses the
 * agentic loop deliberately — the user must answer the inline card before
 * the agent proceeds. If we allowed auto-continuation here the SDK would
 * immediately send the tool result back to the model, which would call
 * `askClarifyingQuestions` again and render a duplicate question card.
 */
function sendAutomaticallyWhen({ messages }: { messages: UIMessage[] }): boolean {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (lastAssistant) {
    const calledAskQuestions = lastAssistant.parts.some(
      (p) => p.type === "tool-askClarifyingQuestions",
    );
    if (calledAskQuestions) return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}


export function ActiveSession({
  projectId,
  sessionId,
  initialMessages,
  active,
}: ActiveSessionProps) {
  const router = useRouter();

  const selectedModel = useWorkspaceStore((s) =>
    resolveSessionModel(sessionId, projectId, s),
  );
  const activeDesignId = useActiveDesignId(projectId);
  const openDesignTab = useWorkspaceStore((s) => s.openDesignTab);
  const setSessionTitleOverride = useWorkspaceStore(
    (s) => s.setSessionTitleOverride,
  );
  const setSessionUsage = useWorkspaceStore((s) => s.setSessionUsage);
  const addSummarizationMarker = useWorkspaceStore(
    (s) => s.addSummarizationMarker,
  );
  const pendingMessage = useWorkspaceStore(
    (s) => s.pendingChatMessageBySession[sessionId],
  );
  const consumeChatMessage = useWorkspaceStore((s) => s.consumeChatMessage);
  const pendingSubmission = useWorkspaceStore(
    (s) => s.pendingComposerSubmissionBySession[sessionId],
  );
  const consumeComposerSubmission = useWorkspaceStore(
    (s) => s.consumeComposerSubmission,
  );
  const selfCritique = useWorkspaceStore(
    (s) => s.selfCritiqueBySession[sessionId] ?? false,
  );
  const stopRequested = useWorkspaceStore((s) =>
    Boolean(s.requestedStopBySession[sessionId]),
  );
  const clearSessionStop = useWorkspaceStore((s) => s.clearSessionStop);
  const [chatError, setChatError] = useState<ChatError | null>(null);

  const selfCritiqueRef = useRef(selfCritique);
  useEffect(() => {
    selfCritiqueRef.current = selfCritique;
  }, [selfCritique]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/projects/${projectId}/chat`,
        prepareSendMessagesRequest: ({
          messages,
          id,
          trigger,
          messageId,
          body,
        }) => ({
          body: {
            ...body,
            id,
            messages,
            trigger,
            messageId,
            sessionId,
            modelId: resolveModelOption(selectedModel).modelId,
            provider: resolveModelOption(selectedModel).provider,
            activeDesignId,
            selfCritique: selfCritiqueRef.current,
          },
        }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, sessionId, selectedModel, activeDesignId],
  );

  // Keep a ref to the latest messages so onData callbacks can read the current
  // length without capturing a stale closure.
  const messagesRef = useRef<UIMessage[]>([]);

  const { messages, sendMessage, status, stop, addToolResult } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName !== "screenshotDesign") return;
      const input = toolCall.input as { designId?: string };
      const designId = input?.designId;
      if (!designId) {
        addToolResult({
          tool: "screenshotDesign",
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText:
            "Missing designId. Pass the id of the design you want to screenshot.",
        });
        return;
      }
      try {
        const uploaded = await captureDesignScreenshot({ projectId, designId });
        addToolResult({
          tool: "screenshotDesign",
          toolCallId: toolCall.toolCallId,
          output: { url: uploaded.url, mediaType: uploaded.mimeType },
        });
      } catch (err) {
        addToolResult({
          tool: "screenshotDesign",
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText:
            err instanceof Error
              ? err.message
              : "Couldn't capture the canvas — the live preview may still be compiling.",
        });
      }
    },
    sendAutomaticallyWhen,
    onData: (part) => {
      if (part.type === "data-session-title") {
        const payload = part.data as { sessionId: string; title: string };
        if (payload?.sessionId && payload.title) {
          setSessionTitleOverride(payload.sessionId, payload.title);
        }
      }
      if (part.type === "data-session-usage") {
        const payload = part.data as {
          sessionId: string;
          currentInputTokens: number;
          lifetimeFoldedTokens: number;
          lifetimeOutputTokens: number;
          summarizedCount: number;
          totalCostUsd: number;
          justSummarized: boolean;
        };
        if (payload?.sessionId) {
          setSessionUsage(payload.sessionId, {
            currentInputTokens: payload.currentInputTokens,
            lifetimeFoldedTokens: payload.lifetimeFoldedTokens,
            lifetimeOutputTokens: payload.lifetimeOutputTokens,
            summarizedCount: payload.summarizedCount,
            totalCostUsd: payload.totalCostUsd,
          });
          if (payload.justSummarized) {
            // Mark the last message index so the message list can render an
            // in-chat banner. messagesRef reflects the state at the time the
            // usage event fires (after the assistant turn has streamed in).
            const idx = Math.max(0, messagesRef.current.length - 1);
            addSummarizationMarker(payload.sessionId, idx);
          }
        }
      }
    },
    onFinish: () => {
      router.refresh();
    },
    onError: (err) => {
      console.error(err);
      setChatError(parseChatError(err));
    },
  });

  // Keep the messages ref in sync so onData can read the latest message count.
  messagesRef.current = messages;

  // Respond to stop requests forwarded by the global Composer's Stop button
  // (and by the "close while streaming" confirmation in SessionTabs).
  useEffect(() => {
    if (!stopRequested) return;
    void stop();
    clearSessionStop(sessionId);
  }, [stopRequested, stop, clearSessionStop, sessionId]);

  // Bridge for plain-text messages enqueued from outside the chat pane
  // (e.g. inline clarifying questions in the canvas).
  useEffect(() => {
    if (!pendingMessage) return;
    setChatError(null);
    void sendMessage({ text: pendingMessage });
    consumeChatMessage(sessionId);
  }, [pendingMessage, sendMessage, consumeChatMessage, sessionId]);

  // Bridge for rich submissions assembled by the always-mounted global
  // Composer. The Composer enqueues parts onto whatever session id was
  // active when the user pressed Send; this effect runs in whichever
  // ActiveSession actually owns that id and hands it to `useChat`.
  // Together with `migrateSessionState` in handleNew, this means a Send
  // pressed during the temp window still lands cleanly on the real
  // session — no special-casing in the Composer required.
  useEffect(() => {
    if (!pendingSubmission) return;
    setChatError(null);
    void sendMessage({ parts: pendingSubmission });
    consumeComposerSubmission(sessionId);
  }, [pendingSubmission, sendMessage, consumeComposerSubmission, sessionId]);

  const navigatedToolCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (part.type !== "tool-createDesign") continue;
        const p = part as {
          toolCallId: string;
          state: string;
          output?: { designId?: string };
        };
        if (p.state !== "output-available") continue;
        if (navigatedToolCallIds.current.has(p.toolCallId)) continue;
        const designId = p.output?.designId;
        if (!designId) continue;
        navigatedToolCallIds.current.add(p.toolCallId);
        openDesignTab(projectId, designId);
      }
    }
  }, [messages, openDesignTab, projectId]);

  const refreshedToolCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    let didRefresh = false;
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (
          part.type !== "tool-createDesign" &&
          part.type !== "tool-editDesign" &&
          part.type !== "tool-deleteDesign" &&
          part.type !== "tool-renameDesign" &&
          part.type !== "tool-createFolder" &&
          part.type !== "tool-moveDesign" &&
          part.type !== "tool-moveFolder"
        ) {
          continue;
        }
        const p = part as { toolCallId: string; state: string };
        if (p.state !== "output-available") continue;
        if (refreshedToolCallIds.current.has(p.toolCallId)) continue;
        refreshedToolCallIds.current.add(p.toolCallId);
        didRefresh = true;
      }
    }
    if (didRefresh) router.refresh();
  }, [messages, router]);

  const isStreaming = status === "streaming" || status === "submitted";

  // Pump streaming state into the store so the global Composer (which
  // doesn't have direct access to this useChat) can flip its Send button
  // to a Stop button while a turn is in flight on the active session.
  const setSessionStreaming = useWorkspaceStore((s) => s.setSessionStreaming);
  useEffect(() => {
    setSessionStreaming(sessionId, isStreaming);
  }, [isStreaming, sessionId, setSessionStreaming]);
  useEffect(() => {
    return () => setSessionStreaming(sessionId, false);
  }, [sessionId, setSessionStreaming]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={active ? undefined : { display: "none" }}
    >
      <MessageList
        sessionId={sessionId}
        messages={messages}
        status={status}
        chatError={chatError}
      />
    </div>
  );
}
