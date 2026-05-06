import { match, P } from "ts-pattern";
import type { ChatError } from "@/components/workspace/chat/types/chat-errors";

export type { ChatError };

export const PROVIDER_DISPLAY: Record<string, string> = {
  CLAUDE: "Claude",
  OPENAI: "OpenAI",
  GEMINI: "Gemini",
  ANTHROPIC: "Claude",
  GOOGLE: "Gemini",
};

// Wire format used by the server to send a structured error through the
// UI message stream. The client recovers it via `parseChatError`.
const STRUCTURED_PREFIX = "__CHAT_ERR__:";

export function encodeChatError(error: ChatError): string {
  return STRUCTURED_PREFIX + JSON.stringify(error);
}

function decodeStructured(raw: string): ChatError | null {
  if (!raw.startsWith(STRUCTURED_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(STRUCTURED_PREFIX.length)) as ChatError;
    if (parsed && typeof parsed === "object" && "type" in parsed) return parsed;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Best-effort classification of an error string into a friendly `ChatError`.
 * Handles:
 *   - structured errors emitted by the server (`encodeChatError`)
 *   - JSON `{ error: "..." }` bodies (preflight 4xx responses)
 *   - raw provider error messages (Anthropic/OpenAI/Google)
 *   - network failures (fetch TypeError)
 */
export function parseChatError(err: unknown): ChatError {
  const raw = match(err)
    .with({ message: P.string }, (e) => e.message)
    .with(P.string, (s) => s)
    .otherwise(() => "");

  const structured = decodeStructured(raw);
  if (structured) return structured;

  // Preflight JSON errors from the API route.
  let text = raw;
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) text = parsed.error;
  } catch {
    // not JSON
  }

  // The extracted text may itself be a structured error (e.g. when the server
  // returns a 400 with { error: "__CHAT_ERR__:..." }).
  const structuredFromJson = decodeStructured(text);
  if (structuredFromJson) return structuredFromJson;

  const lower = text.toLowerCase();

  // Network / fetch failure (browser TypeError "Failed to fetch").
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("load failed")
  ) {
    return { type: "network" };
  }

  // Missing key (our own preflight message).
  const missing = /no api key configured for (\w+)/i.exec(text);
  if (missing) {
    return { type: "api-key-missing", provider: missing[1].toUpperCase() };
  }

  // Invalid key — provider-specific phrasings.
  if (
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key") ||
    lower.includes("authentication_error") ||
    lower.includes("unauthorized") ||
    lower.includes("api key not valid") ||
    lower.includes("permission denied") ||
    lower.includes("401")
  ) {
    return {
      type: "api-key-invalid",
      provider: detectProvider(lower) ?? "your provider",
    };
  }

  // Rate limit / quota.
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("429")
  ) {
    return { type: "rate-limit", provider: detectProvider(lower) };
  }

  // Model not found.
  const modelMatch =
    /model[^a-z0-9_-]+([a-z0-9._-]+)[^a-z0-9_-]+(?:not found|does not exist|is not supported)/i.exec(
      text,
    );
  if (modelMatch) {
    return { type: "model-not-found", modelId: modelMatch[1] };
  }
  if (lower.includes("model not found") || lower.includes("model_not_found")) {
    return { type: "model-not-found", modelId: null };
  }

  return { type: "generic", message: text || "Something went wrong." };
}

function detectProvider(lower: string): string | null {
  if (lower.includes("anthropic") || lower.includes("claude")) return "CLAUDE";
  if (lower.includes("openai") || lower.includes("gpt")) return "OPENAI";
  if (lower.includes("google") || lower.includes("gemini")) return "GEMINI";
  return null;
}

export function providerName(provider: string): string {
  return PROVIDER_DISPLAY[provider] ?? provider;
}
