"use client";

import { useMemo } from "react";
import { Copy } from "lucide-react";
import type { UIMessage } from "ai";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui";
import { collectText } from "@/components/workspace/chat/utils/message-utils";
import { MessagePartView } from "@/components/workspace/chat/message-part-view";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Keep only the last screenshotDesign call per rationale. The agent sometimes
// calls the tool twice in one turn with an identical rationale (e.g. a
// re-review after a hot-reload delay); showing both looks like a rendering bug.
function dedupeScreenshotParts(parts: UIMessage["parts"]): UIMessage["parts"] {
  const lastIdxByRationale = new Map<string, number>();
  parts.forEach((part, i) => {
    const p = part as { type?: string; input?: { rationale?: string } };
    if (p.type === "tool-screenshotDesign") {
      lastIdxByRationale.set(p.input?.rationale ?? "", i);
    }
  });
  return parts.filter((part, i) => {
    const p = part as { type?: string; input?: { rationale?: string } };
    if (p.type !== "tool-screenshotDesign") return true;
    return lastIdxByRationale.get(p.input?.rationale ?? "") === i;
  });
}

// ---------------------------------------------------------------------------
// CopyMessageButton
// ---------------------------------------------------------------------------

function CopyMessageButton({ text }: { text: string }) {
  return (
    <IconButton
      aria-label="Copy message"
      className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
      icon={<Copy className="size-3" />}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// MessageRow — public API
// ---------------------------------------------------------------------------

export function MessageRow({
  message,
  isStreaming,
  sessionId,
}: {
  message: UIMessage;
  isStreaming: boolean;
  sessionId: string;
}) {
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
