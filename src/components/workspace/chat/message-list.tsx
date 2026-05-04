"use client";

import { Fragment } from 'react';

import { ChevronDown } from "lucide-react";
import type { UIMessage } from "ai";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { type ChatError } from "@/components/workspace/chat/utils/chat-errors";
import { MessageRow } from "@/components/workspace/chat/message-row";
import { SummarizationBanner } from "@/components/workspace/chat/summarization-banner";
import { WorkingIndicator } from "@/components/workspace/chat/working-indicator";
import { ChatErrorBanner } from "@/components/workspace/chat/chat-error-banner";
import { useChatScroll } from "@/components/workspace/chat/hooks/use-chat-scroll";

// Stable empty array — never recreated, so Zustand selectors that fall back
// to this don't trigger spurious re-renders.
const NO_MARKERS: number[] = [];

interface MessageListProps {
  sessionId: string;
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  chatError?: ChatError | null;
}

// ---------------------------------------------------------------------------
// ScrollToBottomButton
// ---------------------------------------------------------------------------

function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to bottom"
      className="absolute bottom-3 right-4 flex size-7 items-center justify-center rounded-full border border-border bg-background shadow-md text-ink-muted transition-colors hover:bg-muted hover:text-ink"
    >
      <ChevronDown className="size-4" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// MessageList — public API
// ---------------------------------------------------------------------------

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

  // A tool call is "in flight" only while the chat is actively streaming.
  // Once status flips to ready/error (including when the user hits Stop),
  // any tool whose state is still input-* is treated as finished.
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
