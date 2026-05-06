"use client";

import { Fragment } from 'react';

import { useWorkspaceStore } from "@/stores/workspace-store";
import { MessageRow } from "@/components/workspace/chat/message-row";
import { SummarizationBanner } from "@/components/workspace/chat/summarization-banner";
import { WorkingIndicator } from "@/components/workspace/chat/working-indicator";
import { ChatErrorBanner } from "@/components/workspace/chat/chat-error-banner";
import { useChatScroll } from "@/components/workspace/chat/hooks/use-chat-scroll";
import { ScrollToBottomButton } from "@/components/workspace/chat/scroll-to-bottom-button";
import type { MessageListProps } from "@/components/workspace/chat/types/messages";

// Stable empty array — never recreated, so Zustand selectors that fall back
// to this don't trigger spurious re-renders.
const NO_MARKERS: number[] = [];

export function MessageList({
  sessionId,
  messages,
  status,
  chatError,
}: MessageListProps) {
  const summarizationMarkers =
    useWorkspaceStore((s) => s.summarizationMarkersById[sessionId]) ??
    NO_MARKERS;

  const { scrollRef, isAtBottom, scrollToBottom, handleScroll } =
    useChatScroll(messages, status);

  const isStreaming = status === "submitted" || status === "streaming";

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-ink-muted">
        Start chatting with your agent.
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full space-y-4 overflow-y-auto px-3 py-3"
      >
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            <MessageRow
              message={m}
              isStreaming={isStreaming}
              sessionId={sessionId}
            />
            {summarizationMarkers.includes(i) ? <SummarizationBanner /> : null}
          </Fragment>
        ))}
        {isStreaming ? <WorkingIndicator /> : null}
        {chatError ? <ChatErrorBanner error={chatError} /> : null}
      </div>
      {!isAtBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
}
