"use client";

import type { UIMessagePart, UIDataTypes, UITools } from "ai";

import { AnimatedEllipsis } from "@/components/workspace/chat/animated-ellipsis";
import { getToolDisplay } from "@/components/workspace/chat/utils/tool-display";
import { CHAT_ERR_PREFIX } from "@/components/workspace/chat/utils/message-utils";

export function ToolCallView({
  part,
  isStreaming,
  labelOverride,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isStreaming: boolean;
  labelOverride?: { active: string; past: string };
}) {
  const anyPart = part as {
    type: string;
    toolName?: string;
    state?: string;
    errorText?: string;
  };
  const toolName = anyPart.toolName ?? anyPart.type.replace(/^tool-/, "");
  const display = getToolDisplay(toolName);
  const activeLabel = labelOverride?.active ?? display.activeLabel;
  const pastLabel = labelOverride?.past ?? display.pastLabel;
  const Icon = display.icon;

  // The AI SDK marks a tool part as still pending while it's in either
  // 'input-streaming' or 'input-available'. Once it resolves it transitions
  // to 'output-available' / 'output-error' / 'output-denied'. If the user
  // hits Stop mid-call, the part is frozen in an input-* state but the chat
  // status flips to 'ready'/'error' — so we also treat any in-flight tool
  // as "done" once streaming ends, surfacing the past-tense label without
  // an animation. This matches the user's mental model: the work either
  // finished or isn't happening any more.
  const isPending =
    isStreaming &&
    (anyPart.state === "input-streaming" ||
      anyPart.state === "input-available");
  const hasError =
    anyPart.state === "output-error" || Boolean(anyPart.errorText);

  return (
    <div className="my-1 pl-3 text-xs text-ink-subtle">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span>
          {isPending ? activeLabel : pastLabel}
          {isPending ? <AnimatedEllipsis /> : null}
        </span>
      </div>
      {hasError && anyPart.errorText && !anyPart.errorText.startsWith(CHAT_ERR_PREFIX) ? (
        <div className="mt-0.5 pl-[18px] text-destructive">
          {anyPart.errorText}
        </div>
      ) : null}
    </div>
  );
}
