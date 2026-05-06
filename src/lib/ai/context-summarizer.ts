import { generateText, type ModelMessage } from "ai";

import type {
  SummarizeArgs,
  RollingSummaryArgs,
  RollingSummaryResult,
} from "./types/context-summarizer";
import {
  CHARS_PER_TOKEN,
  estimateTokens,
  messageTokens,
} from "./utils/tokens";

export type { RollingSummaryArgs, RollingSummaryResult };
export { estimateTokens };

const TRIGGER_RATIO = 0.6;
const TARGET_RATIO = 0.45;
const SUMMARY_MAX_CHARS = 1000;
const SUMMARY_RESERVED_TOKENS = 300;

// === Summarization =======================================================

const SUMMARIZER_SYSTEM_PROMPT = `You compress earlier portions of a design chat into a dense, factual summary so the assistant can keep working with bounded context.

Rules:
- Output ONLY the summary text — no preamble, no headings, no bullet markers.
- Maximum ${SUMMARY_MAX_CHARS} characters. Be terse.
- Preserve: user goals, design decisions made, constraints / requirements, names of files or components touched, and any tool outputs the assistant relied on.
- Drop: pleasantries, restated questions, code that has already been replaced, exploratory dead-ends.
- Write in third person ("the user asked...", "the assistant created...").
- If a previous summary is provided, MERGE it with the new content into a single summary that respects the character cap.`;

async function summarize({
  messagesToFold,
  previousSummary,
  summarizerModel,
}: SummarizeArgs): Promise<string | null> {
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
