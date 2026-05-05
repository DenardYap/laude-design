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
import { useApiKeysStore } from "@/stores/api-keys-store";
import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { MessageList } from "@/components/workspace/chat/message-list";
import {
  type ChatError,
  parseChatError,
} from "@/components/workspace/chat/utils/chat-errors";
import { useActiveDesignId } from "@/components/workspace/chat/hooks/use-active-design";
import { captureDesignScreenshot } from "@/components/workspace/canvas/utils/capture-design";

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

  // useChat holds onto the original transport ref internally and doesn't
  // swap it out when the prop changes, so closures inside
  // prepareSendMessagesRequest would capture stale values. Use refs for
  // anything that can change after mount (model, activeDesignId) so every
  // send always reads the latest value regardless of when transport was
  // first constructed.
  const selectedModelRef = useRef(selectedModel);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  const activeDesignIdRef = useRef(activeDesignId);
  useEffect(() => {
    activeDesignIdRef.current = activeDesignId;
  }, [activeDesignId]);

  // Clear any stale error banner when the user switches to a different model —
  // the old error (e.g. "No API key for Claude") no longer applies.
  useEffect(() => {
    setChatError(null);
  }, [selectedModel]);

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
        }) => {
          const active = resolveModelOption(selectedModelRef.current);
          // Read the key synchronously from store state — no hook needed.
          // Sent as a header rather than a body field so it stays out of
          // request-body logs and can be stripped by a reverse proxy with a
          // single `proxy_hide_header` directive.
          const apiKey = (useApiKeysStore.getState().keys as Record<string, string | undefined>)[active.provider] ?? "";
          return {
            headers: {
              "x-provider-api-key": apiKey,
            },
            body: {
              ...body,
              id,
              messages,
              trigger,
              messageId,
              sessionId,
              modelId: active.modelId,
              provider: active.provider,
              activeDesignId: activeDesignIdRef.current,
              selfCritique: selfCritiqueRef.current,
            },
          };
        },
      }),
    // selectedModel and activeDesignId are intentionally omitted — they are
    // accessed via refs so the transport never needs to be reconstructed when
    // they change (useChat wouldn't pick up a new transport anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, sessionId],
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

  // Auto-navigate the canvas to any design the agent has just finished
  // creating via the `createDesign` tool. The id-set ref guarantees each
  // tool call only triggers navigation once even though `messages` is
  // re-emitted on every streamed chunk.
  //
  // We ALSO seed the freshly-created design into the optimistic files
  // overlay before flipping the active tab. Without this, `openDesignTab`
  // would set `activeTab = "design:{newId}"` immediately, but the new id
  // wouldn't appear in the `designs` prop (which is server-sourced) until
  // `router.refresh()` lands ~hundreds of ms later — leaving the user
  // staring at an empty canvas with no visible tab change. The overlay
  // entry, built from the tool's input + output, lets `CanvasTabStrip`
  // render the new tab and `CanvasPane` render the design with its real
  // /App.tsx contents in the same frame as the navigation. The overlay
  // is dropped automatically by `optimistic-files-store.reconcile()` once
  // the server data catches up.
  const addPendingDesign = useOptimisticFilesStore(
    (s) => s.addPendingDesign,
  );
  const navigatedToolCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (part.type !== "tool-createDesign") continue;
        const p = part as {
          toolCallId: string;
          state: string;
          input?: {
            name?: string;
            content?: string;
            folderId?: string | null;
          };
          output?: {
            designId?: string;
            name?: string;
            folderId?: string | null;
          };
        };
        if (p.state !== "output-available") continue;
        if (navigatedToolCallIds.current.has(p.toolCallId)) continue;
        const designId = p.output?.designId;
        if (!designId) continue;
        navigatedToolCallIds.current.add(p.toolCallId);
        const name = p.output?.name ?? p.input?.name ?? "Untitled design";
        const folderId = p.output?.folderId ?? p.input?.folderId ?? null;
        const content = p.input?.content ?? "";
        addPendingDesign({
          id: designId,
          name,
          folderId,
          files: content
            ? [{ path: "/App.tsx", content }]
            : [],
          updatedAt: new Date().toISOString(),
        });
        openDesignTab(projectId, designId);
      }
    }
  }, [messages, openDesignTab, projectId, addPendingDesign]);

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
