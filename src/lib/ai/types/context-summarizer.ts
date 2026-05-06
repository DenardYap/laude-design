import type { ModelMessage, LanguageModel } from "ai";

export interface SummarizeArgs {
  messagesToFold: ModelMessage[];
  previousSummary: string | null;
  summarizerModel: LanguageModel;
}

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
