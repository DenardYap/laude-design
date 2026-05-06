import { match, P } from "ts-pattern";
import type { UIMessagePart, UIDataTypes, UITools } from "ai";

import { isInternalNote } from "@/lib/workspace/internal-notes";
import { parseTagMarker } from "@/lib/workspace/tag-markers";
import { Markdown } from "@/components/workspace/chat/markdown";
import { TagChip } from "@/components/workspace/chat/tag-chip";
import { InlineDesignPlan } from "@/components/workspace/chat/inline-design-plan";
import { InlineClarifyingQuestions } from "@/components/workspace/chat/inline-clarifying-questions";
import { FileAttachment } from "@/components/workspace/chat/file-attachment";
import { ScreenshotToolView } from "@/components/workspace/chat/screenshot-tool-view";
import { ToolCallView } from "@/components/workspace/chat/tool-call-view";
import { CHAT_ERR_PREFIX } from "@/components/workspace/chat/utils/message-utils";
import type { ClarifyingQuestionItem } from "@/app/api/sessions/[sessionId]/questions/route";

export function MessagePartView({
  part,
  isUser,
  isStreaming,
  sessionId,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isUser: boolean;
  isStreaming: boolean;
  sessionId: string;
}) {
  return match(part)
    .with({ type: "text" }, (p) => {
      if (isInternalNote(p.text) || p.text.startsWith(CHAT_ERR_PREFIX))
        return null;
      const tag = parseTagMarker(p.text);
      if (tag) {
        return (
          <span className="my-1 mr-1 inline-flex max-w-full align-middle">
            <TagChip tag={tag} />
          </span>
        );
      }
      return isUser ? (
        <p className="whitespace-pre-wrap break-words">{p.text}</p>
      ) : (
        <Markdown>{p.text}</Markdown>
      );
    })
    .with({ type: "reasoning" }, (p) => (
      <p className="whitespace-pre-wrap text-xs italic text-ink-muted">
        {p.text}
      </p>
    ))
    .with({ type: "file" }, (p) => (
      <FileAttachment
        mediaType={p.mediaType}
        url={p.url}
        filename={p.filename}
      />
    ))
    .with({ type: "tool-planDesign" }, (p) => {
      const anyPart = p as {
        input?: { title?: string; steps?: { id: string; label: string }[] };
        output?: { planId?: string };
      };
      return (
        <InlineDesignPlan
          planId={anyPart.output?.planId}
          fallbackTitle={anyPart.input?.title}
          fallbackSteps={anyPart.input?.steps}
        />
      );
    })
    .with({ type: "tool-askClarifyingQuestions" }, (p) => {
      const anyPart = p as {
        state?: string;
        input?: { rationale?: string; questions?: ClarifyingQuestionItem[] };
        output?: { questionSetId?: string };
      };
      return (
        <InlineClarifyingQuestions
          sessionId={sessionId}
          state={anyPart.state}
          questionSetId={anyPart.output?.questionSetId}
          fallbackRationale={anyPart.input?.rationale}
          fallbackItems={anyPart.input?.questions}
        />
      );
    })
    .with({ type: "tool-completePlanStep" }, (p) => {
      // Custom label: "Completed step 3" instead of generic "Completed step".
      const anyPart = p as { output?: { stepNumber?: number } };
      const num = anyPart.output?.stepNumber;
      return (
        <ToolCallView
          part={p}
          isStreaming={isStreaming}
          labelOverride={
            num !== undefined
              ? {
                  active: `Completing step ${num}`,
                  past: `Completed step ${num}`,
                }
              : undefined
          }
        />
      );
    })
    .with({ type: "tool-screenshotDesign" }, (p) => (
      <ScreenshotToolView part={p} isStreaming={isStreaming} />
    ))
    .with({ type: P.string.startsWith("tool-") }, (p) => (
      <ToolCallView part={p} isStreaming={isStreaming} />
    ))
    .with({ type: "dynamic-tool" }, (p) => (
      <ToolCallView part={p} isStreaming={isStreaming} />
    ))
    .with({ type: "step-start" }, () => null)
    .otherwise(() => null);
}
