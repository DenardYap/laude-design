"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";

import type { ApiKeySummary, ChatSessionDTO } from "@/lib/workspace/types";
import { resolveModelOption } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { TEMP_SESSION_PREFIX } from "@/components/workspace/chat/session-tabs";
import {
  Composer,
  type ComposerSendParts,
} from "@/components/workspace/chat/composer";
import { MessageList } from "@/components/workspace/chat/message-list";
import {
  type ChatError,
  parseChatError,
} from "@/components/workspace/chat/chat-errors";
import { useActiveDesignId } from "@/components/workspace/chat/use-active-design";

interface ChatPaneProps {
  projectId: string;
  sessions: ChatSessionDTO[];
  apiKeys: ApiKeySummary[];
}

export function ChatPane({ projectId, sessions, apiKeys }: ChatPaneProps) {
  // We deliberately don't fall back to sessions[0] anymore — closing every
  // tab is a valid empty state. The user can re-open a session from the
  // History popover or start a new one with the + button.
  const activeSessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[projectId],
  );
  // Defensive: if the persisted active session no longer exists server-side
  // (e.g. deleted in another tab), fall back to the placeholder rather than
  // trying to load a dead id.
  const isKnownSession = activeSessionId
    ? sessions.some((s) => s.id === activeSessionId)
    : false;

  const isTempSession =
    activeSessionId?.startsWith(TEMP_SESSION_PREFIX) ?? false;
  const renderActive = activeSessionId && (isKnownSession || isTempSession);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {renderActive && !isTempSession ? (
        <ActiveSessionLoader
          key={activeSessionId}
          projectId={projectId}
          sessionId={activeSessionId!}
          apiKeys={apiKeys}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-ink-muted">
          Start chatting with your agent.
        </div>
      )}
    </div>
  );
}

interface ActiveSessionProps {
  projectId: string;
  sessionId: string;
  apiKeys: ApiKeySummary[];
}

// The Vercel AI SDK's `useChat` only reads its `messages` prop once, on
// construction (or when `id` changes). If we mount it before the persisted
// history has loaded, it'll lock in an empty array and never reconcile —
// which is why a hard refresh used to show no history until the user
// switched sessions and back. Gate the chat behind the initial fetch so
// the Chat instance is always constructed with the real messages.
function ActiveSessionLoader({
  projectId,
  sessionId,
  apiKeys,
}: ActiveSessionProps) {
  const initial = useQuery({
    queryKey: ["session-messages", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = (await res.json()) as { messages: UIMessage[] };
      return data.messages;
    },
    staleTime: 30_000,
  });

  if (initial.isPending) {
    return <div className="flex flex-1" aria-busy="true" />;
  }

  return (
    <ActiveSession
      projectId={projectId}
      sessionId={sessionId}
      apiKeys={apiKeys}
      initialMessages={initial.data ?? []}
    />
  );
}

interface ActiveSessionInnerProps extends ActiveSessionProps {
  initialMessages: UIMessage[];
}

function ActiveSession({
  projectId,
  sessionId,
  apiKeys,
  initialMessages,
}: ActiveSessionInnerProps) {
  const router = useRouter();
  const selected = useWorkspaceStore(
    (s) => s.selectedModelByProject[projectId],
  );
  const activeDesignId = useActiveDesignId(projectId);
  const openDesignTab = useWorkspaceStore((s) => s.openDesignTab);
  const setSessionTitleOverride = useWorkspaceStore(
    (s) => s.setSessionTitleOverride,
  );
  const setSessionUsage = useWorkspaceStore((s) => s.setSessionUsage);
  const pendingMessage = useWorkspaceStore(
    (s) => s.pendingChatMessageBySession[sessionId],
  );
  const consumeChatMessage = useWorkspaceStore((s) => s.consumeChatMessage);
  const [chatError, setChatError] = React.useState<ChatError | null>(null);

  const transport = React.useMemo(
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
            modelId: resolveModelOption(selected).modelId,
            provider: resolveModelOption(selected).provider,
            activeDesignId,
          },
        }),
      }),
    [projectId, sessionId, selected, activeDesignId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onData: (part) => {
      // Server streams a `data-session-title` chunk after the first turn so
      // we can rename the tab live, before `router.refresh()` arrives with
      // fresh server data.
      if (part.type === "data-session-title") {
        const payload = part.data as { sessionId: string; title: string };
        if (payload?.sessionId && payload.title) {
          setSessionTitleOverride(payload.sessionId, payload.title);
        }
      }
      // Same pattern for usage stats — fold the new totals straight into the
      // store so the indicator updates the moment the turn finishes.
      if (part.type === "data-session-usage") {
        const payload = part.data as {
          sessionId: string;
          cumulativeInputTokens: number;
          cumulativeOutputTokens: number;
          summarizedCount: number;
          totalCostUsd: number;
        };
        if (payload?.sessionId) {
          setSessionUsage(payload.sessionId, {
            cumulativeInputTokens: payload.cumulativeInputTokens,
            cumulativeOutputTokens: payload.cumulativeOutputTokens,
            summarizedCount: payload.summarizedCount,
            totalCostUsd: payload.totalCostUsd,
          });
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

  // Bridge for messages enqueued from outside the chat pane (e.g. the
  // inline clarifying-questions UI calling `enqueueChatMessage` after the
  // user submits answers).
  React.useEffect(() => {
    if (!pendingMessage) return;
    setChatError(null);
    void sendMessage({ text: pendingMessage });
    consumeChatMessage(sessionId);
  }, [pendingMessage, sendMessage, consumeChatMessage, sessionId]);

  // When the agent finishes a `createDesign` tool call, jump the canvas to
  // the new design — but only the first time we see that tool call. We track
  // handled toolCallIds in a ref so reloading messages, switching tabs back,
  // or re-rendering doesn't keep yanking the canvas off whatever the user
  // is now looking at.
  const navigatedToolCallIds = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
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

  // Refresh server data the moment any file-mutating tool call resolves so
  // the canvas reflects the agent's edits live, without waiting for the full
  // turn to finish. `router.refresh()` is debounced internally by Next; we
  // dedupe per-toolCallId here so it only fires once per completed tool.
  const refreshedToolCallIds = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    let didRefresh = false;
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (
          part.type !== "tool-createDesign" &&
          part.type !== "tool-editDesign"
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

  const handleSend = React.useCallback(
    (parts: ComposerSendParts) => {
      setChatError(null);
      void sendMessage({ parts });
    },
    [sendMessage],
  );

  const handleStop = React.useCallback(() => {
    void stop();
  }, [stop]);

  const isStreaming = status === "streaming" || status === "submitted";

  // Mirror the in-flight status into the workspace store so peripheral UI
  // (session tab activity dot, etc.) can react without each consumer needing
  // its own subscription to the chat instance. Clear on unmount so a tab
  // close never leaves a phantom "streaming" tab behind.
  const setSessionStreaming = useWorkspaceStore((s) => s.setSessionStreaming);
  React.useEffect(() => {
    setSessionStreaming(sessionId, isStreaming);
  }, [isStreaming, sessionId, setSessionStreaming]);
  React.useEffect(() => {
    return () => setSessionStreaming(sessionId, false);
  }, [sessionId, setSessionStreaming]);

  return (
    <>
      <MessageList
        sessionId={sessionId}
        messages={messages}
        status={status}
        chatError={chatError}
      />
      <Composer
        projectId={projectId}
        sessionId={sessionId}
        apiKeys={apiKeys}
        streaming={isStreaming}
        onSend={handleSend}
        onStop={handleStop}
      />
    </>
  );
}
