import { match } from "ts-pattern";
import type { UIMessagePart, UIDataTypes, UITools } from "ai";

import { isInternalNote } from "@/lib/workspace/internal-notes";
import { isTagMarker } from "@/lib/workspace/tag-markers";

/** Prefix used to embed structured error payloads inside text parts. */
export const CHAT_ERR_PREFIX = "__CHAT_ERR__:";

/**
 * Extracts visible plain-text content from a message's parts for operations
 * like clipboard copy. Strips internal notes, tag markers, and error payloads.
 */
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
