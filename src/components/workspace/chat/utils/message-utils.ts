import { match } from "ts-pattern";
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";

import { isInternalNote } from "@/lib/workspace/internal-notes";
import { isTagMarker } from "@/lib/workspace/tag-markers";

/** Prefix used to embed structured error payloads inside text parts. */
export const CHAT_ERR_PREFIX = "__CHAT_ERR__:";

/**
 * Keep only the last screenshotDesign call per rationale. The agent sometimes
 * calls the tool twice in one turn with an identical rationale; showing both
 * looks like a rendering bug.
 */
export function dedupeScreenshotParts(parts: UIMessage["parts"]): UIMessage["parts"] {
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

export function collectText(
  parts: UIMessagePart<UIDataTypes, UITools>[],
): string {
  return parts
    .map((p) =>
      match(p)
        .with({ type: "text" }, (x) =>
          isInternalNote(x.text) ||
          isTagMarker(x.text) ||
          x.text.startsWith(CHAT_ERR_PREFIX)
            ? ""
            : x.text,
        )
        .otherwise(() => ""),
    )
    .join("\n")
    .trim();
}
