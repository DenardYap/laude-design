import { generateText, type ModelMessage, type LanguageModel } from "ai";

// === Tunables ============================================================

// Trigger summarization once total tokens reach this fraction of the model's
// context window. 60% leaves comfortable headroom for the next turn + tool
// outputs + the model's response.
const TRIGGER_RATIO = 0.2;

// After summarization, the rolling summary + remaining tail must fit under
// this fraction of the context window. We aim for 45% so the next turn has
// breathing room before the next trigger fires.
const TARGET_RATIO = 0.1;

// Hard cap on the rolling summary itself. ~1000 chars ≈ 250 tokens.
const SUMMARY_MAX_CHARS = 1000;

// Tokens we reserve for the summary placeholder when sizing the tail. Slightly
// larger than SUMMARY_MAX_CHARS / 4 to be safe.
const SUMMARY_RESERVED_TOKENS = 300;

// === Token estimation ====================================================

// Rough heuristic: 1 token ≈ 4 characters. Good enough for trigger decisions
// across all providers; we never need exact counts.
const CHARS_PER_TOKEN = 4;

// Per-image token allowance. Vision models (Claude, GPT-4o, Gemini) charge
// roughly 1k–1.5k tokens for a typical screenshot-sized image — we round up
// to keep the trigger from firing late on image-heavy conversations. The
// `lastInputTokens` floor will correct any drift after the first real step.
const TOKENS_PER_IMAGE = 1500;

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
//
// Three shapes need special handling:
//  1. `file` / `image` parts → flat per-image allowance. The base64 length
//     is a wildly unreliable proxy for the model's image tokenization (a
//     1024² PNG is many MB of base64 but only ~1.5k tokens).
//  2. `tool-result` parts whose `output` carries multimodal content
//     (e.g. `screenshotDesign` returns `{ type: "content", value: [text,
//     image-data] }`). JSON-stringifying that output would count the full
//     base64 string as text — easily 25k+ "tokens" per screenshot — and
//     blow the trigger every turn the screenshot is in scope. Walk the
//     output recursively and apply the same per-part rules instead.
//  3. Everything else → text heuristic (chars / 4).
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

// Recursively size a tool result's output. Handles the three shapes the
// AI SDK v5 emits via `toModelOutput`:
//   - `{ type: "text", value: string }`            → text heuristic
//   - `{ type: "json", value: <serializable> }`    → text heuristic
//   - `{ type: "content", value: <part[]> }`       → sum of `partTokens`
// plus the legacy plain-string and plain-object shapes.
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
  // text/json/error variants and any unknown shape — fall back to the
  // serialized length, which is a safe upper bound for purely-textual
  // outputs (the only over-counting case is multimodal `content`, which
  // we just handled above).
  try {
    return Math.ceil(JSON.stringify(output).length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

function messageTokens(message: ModelMessage): number {
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
  // Provider-reported input token count from the most recent completed step.
  // When provided, used as a floor for the trigger check so that switching to
  // a model with a smaller context window reliably fires summarization even
  // when the character-based estimate falls short of the new threshold.
  lastKnownTokens?: number;
  // Estimated token count for prompt overhead that is NOT in `messages`:
  // system prompt, tool schemas, etc. Added to the message estimate so the
  // trigger reflects the full prompt size the provider actually bills for.
  overheadTokens?: number;
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
  // Estimated token size of the messages just folded into the summary on
  // this call. Added to `ChatSession.cumulativeFoldedTokens` by the caller
  // so the popover's "Input tokens" line stays monotonic across
  // summarizations (= currentInput + cumulativeFolded).
  foldedTokens: number;
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
  lastKnownTokens = 0,
  overheadTokens = 0,
}: RollingSummaryArgs): Promise<RollingSummaryResult> {
  const triggerTokens = Math.floor(contextWindow * TRIGGER_RATIO);
  const targetTokens = Math.floor(contextWindow * TARGET_RATIO);

  const previousSummaryTokens = previousSummary
    ? Math.ceil(previousSummary.length / CHARS_PER_TOKEN)
    : 0;
  // The provider's billed count from the previous turn is the source of
  // truth — it's exactly what the model saw, including correctly tokenized
  // images and the real (not estimated) tool-schema overhead. The local
  // estimate only kicks in on the very first turn (or after a model swap)
  // when `lastKnownTokens` is still 0; do NOT take `Math.max` of the two,
  // because the local estimate over-counts inlined screenshot data URLs
  // (a single screenshot's base64 string can read as 25k "tokens" via the
  // chars/4 heuristic, even though the provider only bills ~1.5k for it),
  // which would cause the summarizer to fire on every turn that has even
  // a few stale screenshots in tool-result history.
  const localEstimate =
    estimateTokens(messages) + previousSummaryTokens + overheadTokens;
  const totalTokens = lastKnownTokens > 0 ? lastKnownTokens : localEstimate;

  if (totalTokens < triggerTokens) {
    return {
      messages,
      summary: previousSummary,
      summarized: false,
      foldedCount: 0,
      foldedTokens: 0,
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
      foldedTokens: 0,
    };
  }

  // Walk forward and find the smallest cut index where the tail fits. The
  // budget we hand `findCutIndex` is the *messages* portion only — system
  // prompt + tool-schema overhead and the new summary block are subtracted
  // here so the final prompt actually lands near `targetTokens`, not
  // `targetTokens + overhead` (which used to silently blow past target on
  // any model with non-trivial tool catalogs).
  const messagesBudget = Math.max(
    targetTokens - overheadTokens - SUMMARY_RESERVED_TOKENS,
    // Floor at 5% of the window so a misconfigured `overheadTokens` can never
    // demand we fold the entire history away.
    Math.floor(contextWindow * 0.05),
  );
  const cutIndex = findCutIndex(messages, messagesBudget);

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
      foldedTokens: 0,
    };
  }

  // Snapshot the size of the slice we're about to remove from the live
  // window, BEFORE we await the summarizer — saves recomputing later and
  // keeps the value in scope for the success branch.
  const foldedTokens = estimateTokens(toFold);

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
      foldedTokens: 0,
    };
  }

  return {
    messages: tail,
    summary: newSummary,
    summarized: true,
    foldedCount: toFold.length,
    foldedTokens,
  };
}

/**
 * Find the smallest index `i` such that the suffix `messages[i..]` fits
 * under `budget` tokens AND the cut lands on a `user` message boundary
 * (so we never split an assistant→tool pair). Falls back to the latest
 * user-message boundary if no smaller cut works.
 */
function findCutIndex(messages: ModelMessage[], budget: number): number {
  // Pre-compute suffix token totals: suffixTokens[i] = tokens of messages[i..].
  const n = messages.length;
  const suffixTokens = new Array<number>(n + 1);
  suffixTokens[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    suffixTokens[i] = suffixTokens[i + 1] + messageTokens(messages[i]);
  }

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
