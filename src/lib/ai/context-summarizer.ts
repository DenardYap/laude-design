import { generateText, type ModelMessage, type LanguageModel } from "ai";

// === Tunables ============================================================

// Trigger summarization once total tokens reach this fraction of the model's
// context window. 60% leaves comfortable headroom for the next turn + tool
// outputs + the model's response.
const TRIGGER_RATIO = 0.6;

// After summarization, the rolling summary + remaining tail must fit under
// this fraction of the context window. We aim for 45% so the next turn has
// breathing room before the next trigger fires.
const TARGET_RATIO = 0.45;

// Hard cap on the rolling summary itself. ~1000 chars ≈ 250 tokens.
const SUMMARY_MAX_CHARS = 1000;

// Tokens we reserve for the summary placeholder when sizing the tail. Slightly
// larger than SUMMARY_MAX_CHARS / 4 to be safe.
const SUMMARY_RESERVED_TOKENS = 300;

// === Token estimation ====================================================

// Rough heuristic: 1 token ≈ 4 characters. Good enough for trigger decisions
// across all providers; we never need exact counts.
const CHARS_PER_TOKEN = 4;

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
  // ToolResultPart — count the stringified output
  if (p.type === "tool-result" && p.output !== undefined) {
    try {
      return typeof p.output === "string" ? p.output : JSON.stringify(p.output);
    } catch {
      return "";
    }
  }
  return "";
}

function messageChars(message: ModelMessage): number {
  const { content } = message;
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;
  let total = 0;
  for (const part of content) total += textOfPart(part).length;
  return total;
}

export function estimateTokens(messages: ModelMessage[]): number {
  let chars = 0;
  for (const m of messages) chars += messageChars(m);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

// === Summarization =======================================================

const SUMMARIZER_SYSTEM_PROMPT = `You compress earlier portions of a design chat into a dense, factual summary so the assistant can keep working with bounded context.

Rules:
- Output ONLY the summary text — no preamble, no headings, no bullet markers.
- Maximum ${SUMMARY_MAX_CHARS} characters. Be terse.
- Preserve: user goals, design decisions made, constraints / requirements, names of files or components touched, and any tool outputs the assistant relied on.
- Drop: pleasantries, restated questions, code that has already been replaced, exploratory dead-ends.
- Write in third person ("the user asked...", "the assistant created...").
- If a previous summary is provided, MERGE it with the new content into a single summary that respects the character cap.`;

interface SummarizeArgs {
  messagesToFold: ModelMessage[];
  previousSummary: string | null;
  summarizerModel: LanguageModel;
}

async function summarize({
  messagesToFold,
  previousSummary,
  summarizerModel,
}: SummarizeArgs): Promise<string | null> {
  // Render the messages we're folding as a flat transcript. We use a custom
  // string format rather than passing them as `messages` because the
  // summarizer is a different model that may not share the same tool schema.
  const transcript = messagesToFold
    .map((m) => `[${m.role.toUpperCase()}]\n${renderContent(m.content)}`)
    .join("\n\n");

  const userContent = [
    previousSummary ? `Previous summary:\n${previousSummary}` : "",
    `Conversation segment to summarize:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  try {
    const result = await generateText({
      model: summarizerModel,
      system: SUMMARIZER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxOutputTokens: 400,
      temperature: 0.2,
    });
    const trimmed = result.text.trim().slice(0, SUMMARY_MAX_CHARS);
    return trimmed || null;
  } catch (err) {
    console.error("[context-summarizer]", err);
    return null;
  }
}

function renderContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") return p.text;
      if (p.type === "tool-call") {
        const name = typeof p.toolName === "string" ? p.toolName : "tool";
        return `<tool-call name="${name}" input=${safeStringify(p.input)} />`;
      }
      if (p.type === "tool-result") {
        const name = typeof p.toolName === "string" ? p.toolName : "tool";
        return `<tool-result name="${name}" output=${safeStringify(p.output)} />`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function safeStringify(value: unknown): string {
  if (value === undefined) return '""';
  if (typeof value === "string") return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '""';
  }
}

// === Rolling-summary entry point ========================================

export interface RollingSummaryArgs {
  // Chronological messages, oldest → newest, post-`convertToModelMessages`.
  messages: ModelMessage[];
  // Prior rolling summary persisted on the session, or null on first run.
  previousSummary: string | null;
  // The active chat model's full context window (tokens).
  contextWindow: number;
  // Model used to produce the summary itself (typically a small/cheap model).
  // If null, we skip summarization and return messages unchanged.
  summarizerModel: LanguageModel | null;
}

export interface RollingSummaryResult {
  // Messages to actually send to the chat model (NOT including the summary;
  // the caller decides where to inject it — usually as a system message).
  messages: ModelMessage[];
  // The (possibly newly generated) rolling summary, or null if there isn't
  // one yet. Persist this back to the session when `summarized` is true.
  summary: string | null;
  // True when this call produced a fresh summary (i.e. caller should write
  // it back to the database). False when nothing changed.
  summarized: boolean;
  // Number of head messages folded into the summary on this call. Useful for
  // metrics / debugging; callers can ignore.
  foldedCount: number;
}

/**
 * Apply rolling-summary policy to a message history.
 *
 * Algorithm:
 *  1. Compute current token estimate (history + previous summary).
 *  2. If under the trigger ratio, return as-is.
 *  3. Otherwise walk from the oldest message forward, accumulating into a
 *     "fold" bucket until the remaining tail fits under the target ratio.
 *     The cut always lands on a `user`-message boundary so we never split
 *     an assistant→tool pair.
 *  4. Ask the summarizer model to merge (previousSummary + folded segment)
 *     into a fresh summary capped at ~1000 chars.
 *  5. Return { tail, newSummary }.
 *
 * The caller is responsible for prepending the summary to the messages it
 * sends to the chat model (typically as an additional system message).
 */
export async function applyRollingSummary({
  messages,
  previousSummary,
  contextWindow,
  summarizerModel,
}: RollingSummaryArgs): Promise<RollingSummaryResult> {
  const triggerTokens = Math.floor(contextWindow * TRIGGER_RATIO);
  const targetTokens = Math.floor(contextWindow * TARGET_RATIO);

  const previousSummaryTokens = previousSummary
    ? Math.ceil(previousSummary.length / CHARS_PER_TOKEN)
    : 0;
  const totalTokens = estimateTokens(messages) + previousSummaryTokens;

  if (totalTokens < triggerTokens) {
    return {
      messages,
      summary: previousSummary,
      summarized: false,
      foldedCount: 0,
    };
  }

  // No summarizer available — return the history untouched. We deliberately
  // don't truncate as a fallback: a missing summary is preferable to silently
  // losing the user's earlier turns.
  if (!summarizerModel) {
    return {
      messages,
      summary: previousSummary,
      summarized: false,
      foldedCount: 0,
    };
  }

  // Walk forward and find the smallest cut index where the tail fits.
  // `cutIndex` is the index of the FIRST message we keep.
  const cutIndex = findCutIndex(messages, targetTokens);

  // Safety: if we somehow can't shrink (e.g. the latest user message alone
  // already exceeds the target — can happen for huge attachments), fall back
  // to keeping just the last message. Better to send a too-large request and
  // let the provider error than to drop the user's current turn.
  const safeCutIndex = Math.min(
    Math.max(cutIndex, 1),
    Math.max(messages.length - 1, 0),
  );

  const toFold = messages.slice(0, safeCutIndex);
  const tail = messages.slice(safeCutIndex);

  if (toFold.length === 0) {
    return {
      messages,
      summary: previousSummary,
      summarized: false,
      foldedCount: 0,
    };
  }

  const newSummary = await summarize({
    messagesToFold: toFold,
    previousSummary,
    summarizerModel,
  });

  // Summarizer failed — keep the existing summary + full history. The chat
  // turn will likely succeed since we're still under the model's hard limit
  // (we trigger at 60%); next turn will retry.
  if (!newSummary) {
    return {
      messages,
      summary: previousSummary,
      summarized: false,
      foldedCount: 0,
    };
  }

  return {
    messages: tail,
    summary: newSummary,
    summarized: true,
    foldedCount: toFold.length,
  };
}

/**
 * Find the smallest index `i` such that messages[i..] fits under
 * `targetTokens` (accounting for the reserved summary tokens), AND the cut
 * lands on a `user` message boundary. Falls back to the last user-message
 * boundary if no smaller cut works.
 */
function findCutIndex(messages: ModelMessage[], targetTokens: number): number {
  // Pre-compute suffix token totals: suffixTokens[i] = tokens of messages[i..].
  const n = messages.length;
  const suffixTokens = new Array<number>(n + 1);
  suffixTokens[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    const t = Math.ceil(messageChars(messages[i]) / CHARS_PER_TOKEN);
    suffixTokens[i] = suffixTokens[i + 1] + t;
  }

  const budget = targetTokens - SUMMARY_RESERVED_TOKENS;

  // Find the smallest i where suffix fits AND messages[i].role === 'user'.
  for (let i = 0; i < n; i++) {
    if (messages[i].role !== "user") continue;
    if (suffixTokens[i] <= budget) return i;
  }

  // No user-boundary cut fits the budget. Take the latest user-message
  // boundary we can find — that still preserves tool-call integrity.
  for (let i = n - 1; i >= 0; i--) {
    if (messages[i].role === "user") return i;
  }

  // No user messages at all (degenerate). Don't cut.
  return 0;
}
