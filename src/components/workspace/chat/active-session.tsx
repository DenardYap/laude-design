"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, ChatAddToolOutputFunction } from "ai";
import type { ActiveSessionProps } from "@/components/workspace/chat/types/messages";
import { sendAutomaticallyWhen } from "@/components/workspace/chat/utils/session-helpers";
import { useChatTransport } from "@/components/workspace/chat/hooks/use-chat-transport";
import { useSessionDataHandler } from "@/components/workspace/chat/hooks/use-session-data-handler";
import { useSessionStopHandler } from "@/components/workspace/chat/hooks/use-session-stop-handler";
import { useSessionStreamingSync } from "@/components/workspace/chat/hooks/use-session-streaming-sync";
import { useSessionMessageBridge } from "@/components/workspace/chat/hooks/use-session-message-bridge";
import { useDesignAutoNavigate } from "@/components/workspace/chat/hooks/use-design-auto-navigate";
import { useToolRouterRefresh } from "@/components/workspace/chat/hooks/use-tool-router-refresh";
import { handleScreenshotToolCall } from "@/components/workspace/canvas/utils/handle-screenshot-tool-call";
import { resolveSessionModel, useWorkspaceStore } from "@/stores/workspace-store";
import { MessageList } from "@/components/workspace/chat/message-list";
import {
  type ChatError,
  parseChatError,
} from "@/components/workspace/chat/utils/chat-errors";

export function ActiveSession({
  projectId,
  sessionId,
  initialMessages,
  active,
}: ActiveSessionProps) {
  const router = useRouter();
  const [chatError, setChatError] = useState<ChatError | null>(null);

  const selectedModel = useWorkspaceStore((s) => resolveSessionModel(sessionId, projectId, s));

  // Clear any stale error banner when the user switches to a different model.
  useEffect(() => {
    setChatError(null);
  }, [selectedModel]);

  const transport = useChatTransport({ projectId, sessionId });

  // Keep a ref to the latest messages so onData callbacks can read the current
  // length without capturing a stale closure.
  const messagesRef = useRef<UIMessage[]>([]);
  const onData = useSessionDataHandler(messagesRef);

  // Break the circular type reference: addToolResult comes from useChat but is
  // needed inside onToolCall (also passed to useChat). The ref is set immediately
  // after each render so it is always current when the callback fires.
  const addToolResultRef = useRef<ChatAddToolOutputFunction<UIMessage> | null>(null);

  const { messages, sendMessage, status, stop, addToolResult } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onToolCall: ({ toolCall }) => {
      if (addToolResultRef.current) {
        return handleScreenshotToolCall({
          toolCall,
          projectId,
          addToolResult: addToolResultRef.current,
        });
      }
    },
    sendAutomaticallyWhen,
    onData,
    onFinish: () => router.refresh(),
    onError: (err) => {
      console.error(err);
      setChatError(parseChatError(err));
    },
  });

  messagesRef.current = messages;
  addToolResultRef.current = addToolResult;

  useSessionStopHandler(sessionId, stop);
  useSessionMessageBridge(sessionId, sendMessage, setChatError);
  useDesignAutoNavigate({ messages, projectId });
  useToolRouterRefresh(messages);

  const isStreaming = status === "streaming" || status === "submitted";
  useSessionStreamingSync(sessionId, isStreaming);

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
