import type { UIMessagePart, UIDataTypes, UITools } from "ai";

import { ClickableImage } from "@/components/shared/clickable-image";
import { ToolCallView } from "@/components/workspace/chat/tool-call-view";

/**
 * Shows the "Reviewed the design" indicator, the rationale caption, and a
 * clickable thumbnail that opens a full-size lightbox so the user can inspect
 * exactly what the agent saw during self-critique.
 */
export function ScreenshotToolView({
  part,
  isStreaming,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isStreaming: boolean;
}) {
  const anyPart = part as {
    input?: { rationale?: string };
    output?: { url?: string };
  };
  const url = anyPart.output?.url;

  return (
    <div className="space-y-1">
      <ToolCallView part={part} isStreaming={isStreaming} />
      {anyPart.input?.rationale ? (
        <p className="pl-6 text-xs text-ink-muted">{anyPart.input.rationale}</p>
      ) : null}
      {url ? (
        <ClickableImage
          src={url}
          alt="Live render reviewed by the agent"
          className="ml-6 max-h-40 rounded-md border border-border"
        />
      ) : null}
    </div>
  );
}
