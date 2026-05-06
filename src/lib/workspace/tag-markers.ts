/**
 * Markers for elements the user "tagged" with the canvas highlight tool.
 *
 * A tag is rendered to the user as an attachment-style chip in both the
 * composer and the sent message bubble. Internally it travels as a regular
 * text part so the LLM can read it (see the system prompt's tagged-element
 * rule) and so it persists alongside the rest of the conversation history.
 *
 * Format: `[laude:tag]{"selector":"...","text":"..."}`
 *
 * Using JSON for the payload keeps escaping trivial regardless of which
 * characters the CSS selector or extracted text contain (`>`, `:`, `"`,
 * newlines, etc.).
 */

import type { TagMarker } from "./types/tag-markers";

export type { TagMarker };

export const TAG_MARKER_PREFIX = "[laude:tag]";

export function buildTagMarker(tag: TagMarker): string {
  return `${TAG_MARKER_PREFIX}${JSON.stringify(tag)}`;
}

export function parseTagMarker(text: string): TagMarker | null {
  if (!text.startsWith(TAG_MARKER_PREFIX)) return null;
  try {
    const json = text.slice(TAG_MARKER_PREFIX.length).trim();
    const parsed = JSON.parse(json) as Partial<TagMarker>;
    if (typeof parsed.selector !== "string") return null;
    return {
      selector: parsed.selector,
      text: typeof parsed.text === "string" ? parsed.text : "",
    };
  } catch {
    return null;
  }
}

export function isTagMarker(text: string): boolean {
  return text.startsWith(TAG_MARKER_PREFIX);
}
