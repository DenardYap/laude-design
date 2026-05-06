import type { ModelMessage } from "ai";

/**
 * Remove empty text content blocks from model messages before sending to the
 * provider. Anthropic (Claude) rejects requests where any message contains a
 * text part with `text: ""` — the API returns a 400
 * "messages: text content blocks must be non-empty" error.
 *
 * This can occur when the AI SDK converts UIMessages to ModelMessages and an
 * assistant turn consists solely of tool calls with no text preamble: the SDK
 * serialises a leading `{ type: "text", text: "" }` block, which Anthropic
 * refuses. OpenAI and Gemini silently accept empty text blocks, so the
 * sanitisation is harmless for non-Anthropic providers.
 */
export function sanitizeModelMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message) => {
    // SystemModelMessage has content: string — exclude it so TypeScript narrows
    // the union to the array-content message types before the spread below.
    if (message.role === "system" || !Array.isArray(message.content)) return message;

    const filtered = message.content.filter(
      (part) => !("type" in part && part.type === "text" && (part as { type: string; text: string }).text === ""),
    );

    if (filtered.length === message.content.length) return message;

    // If every part was an empty text block (degenerate edge case), keep a
    // single non-empty placeholder so the message itself isn't dropped — the
    // provider would reject a message with an empty content array too.
    // The filtered array has a wide union type (union of all parts across all
    // message variants) which TypeScript can't prove is assignable back to the
    // specific UserContent / AssistantContent / ToolContent on each variant.
    // The assertion is safe: we only remove empty text blocks, the role and all
    // other fields are unchanged, so the result is still a valid ModelMessage.
    return {
      ...message,
      content: filtered.length > 0 ? filtered : [{ type: "text" as const, text: " " }],
    } as ModelMessage;
  });
}
