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
