import type { ModelMessage } from "ai";

// Rough heuristic: 1 token ≈ 4 characters.
// 1 image ≈ 1500 tokens.
export const CHARS_PER_TOKEN = 4;
export const TOKENS_PER_IMAGE = 1500;

function textOfPart(part: unknown): string {
  if (!part || typeof part !== "object") return "";
  const p = part as Record<string, unknown>;
  // TextPart, ReasoningPart
  if (typeof p.text === "string") return p.text;
  // ToolCallPart — count the JSON-stringified input
  if (p.type === "tool-call" && p.input !== undefined) {
    try {
      return JSON.stringify(p.input);
    } catch {
      return "";
    }
  }
  return "";
}

// Returns the rough provider-billed token cost for a single message part.
function partTokens(part: unknown): number {
  if (!part || typeof part !== "object") return 0;
  const p = part as Record<string, unknown>;
  if (p.type === "file" || p.type === "image" || p.type === "image-data") {
    return TOKENS_PER_IMAGE;
  }
  if (p.type === "tool-result" && p.output !== undefined) {
    return toolResultTokens(p.output);
  }
  return Math.ceil(textOfPart(part).length / CHARS_PER_TOKEN);
}

// Recursively size a tool result's output.
function toolResultTokens(output: unknown): number {
  if (output === null || output === undefined) return 0;
  if (typeof output === "string") {
    return Math.ceil(output.length / CHARS_PER_TOKEN);
  }
  if (typeof output !== "object") return 0;
  const o = output as Record<string, unknown>;
  if (o.type === "content" && Array.isArray(o.value)) {
    let total = 0;
    for (const sub of o.value) total += partTokens(sub);
    return total;
  }
  // fall back to the serialized length.
  try {
    return Math.ceil(JSON.stringify(output).length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

export function messageTokens(message: ModelMessage): number {
  const { content } = message;
  if (typeof content === "string") {
    return Math.ceil(content.length / CHARS_PER_TOKEN);
  }
  if (!Array.isArray(content)) return 0;
  let total = 0;
  for (const part of content) total += partTokens(part);
  return total;
}

export function estimateTokens(messages: ModelMessage[]): number {
  let total = 0;
  for (const m of messages) total += messageTokens(m);
  return total;
}
