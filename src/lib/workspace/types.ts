import type { AiProvider } from "@/lib/validators";

export type ModelProvider = AiProvider;

export interface ModelOption {
  provider: ModelProvider;
  modelId: string;
  label: string;
  description?: string;
  // Total tokens the model accepts (input + output). Drives rolling-summary
  // thresholds; see `applyRollingSummary` in `src/lib/ai/context-summarizer.ts`.
  contextWindow: number;
}

export interface ChatAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface DesignFileDTO {
  path: string;
  content: string;
}

export interface DesignDTO {
  id: string;
  name: string;
  folderId: string | null;
  files: DesignFileDTO[];
  updatedAt: string;
}

export interface FolderDTO {
  id: string;
  name: string;
  parentId: string | null;
}

// Per-session usage stats surfaced in the chatbox popover.
//
// Decomposition:
//   - `currentInputTokens`: the input the model was billed for on the most
//     recent step (= the live prompt size). Drives the ring's "context
//     window fill" indicator — which MUST shrink visibly when rolling
//     summarization fires, hence using the live value here.
//   - `lifetimeFoldedTokens`: cumulative size of messages the rolling
//     summarizer has folded into the summary. Combined with
//     `currentInputTokens` via `getLifetimeInputTokens` to give the
//     popover's "Input tokens" line a monotonic value (= what
//     `currentInputTokens` would be if summarization had never fired).
//   - `lifetimeOutputTokens`: every assistant token ever generated in this
//     session. Strictly monotonically increasing across turns.
//   - `totalCostUsd`: lifetime cumulative cost. Cost MUST be cumulative
//     because each step legitimately bills new tokens (re-sent history is
//     billed again every turn unless prompt caching catches it).
export interface SessionUsage {
  currentInputTokens: number;
  lifetimeFoldedTokens: number;
  lifetimeOutputTokens: number;
  summarizedCount: number;
  totalCostUsd: number;
}

/**
 * "Input tokens" displayed in the chatbox popover — what the live prompt
 * would weigh if rolling summarization had never folded older messages
 * into a summary. Strictly monotonic across the session lifetime: each
 * turn either grows `currentInputTokens` (more messages added) or grows
 * `lifetimeFoldedTokens` (summarization fired and stashed the size of
 * the folded slice), so the sum never decreases. Pre-first-summarization
 * this just equals `currentInputTokens`.
 */
export function getLifetimeInputTokens(usage: SessionUsage): number {
  return usage.currentInputTokens + usage.lifetimeFoldedTokens;
}

export interface ChatSessionDTO {
  id: string;
  title: string;
  // ISO timestamp of last activity (used to group sessions by recency).
  updatedAt: string;
  // True when the session has no messages — used to dedupe "New Session" tabs
  // and to suppress redundant creates when the user spams the new-session button.
  isEmpty: boolean;
  // Cumulative usage for the chatbox indicator. Hydrated from the DB on load
  // and updated live via the `data-session-usage` stream part after each turn.
  usage: SessionUsage;
}
