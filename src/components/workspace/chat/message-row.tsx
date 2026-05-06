"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { collectText, dedupeScreenshotParts } from "@/components/workspace/chat/utils/message-utils";
import { CopyMessageButton } from "@/components/workspace/chat/copy-message-button";
import { MessagePartView } from "@/components/workspace/chat/message-part-view";
import type { MessageRowProps } from "@/components/workspace/chat/types/messages";

export function MessageRow({
  message,
  isStreaming,
  sessionId,
}: MessageRowProps) {
  const isUser = message.role === "user";
  const text = collectText(message.parts);
  const parts = useMemo(
    () => dedupeScreenshotParts(message.parts),
    [message.parts],
  );

  return (
    <div
      className={cn(
        "group flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "text-sm leading-relaxed text-ink",
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand-soft px-3 py-2"
            : "w-full",
        )}
      >
        {parts.map((part, i) => (
          <MessagePartView
            key={i}
            part={part}
            isUser={isUser}
            isStreaming={isStreaming}
            sessionId={sessionId}
          />
        ))}
      </div>
      {!isUser && text ? <CopyMessageButton text={text} /> : null}
    </div>
  );
}
