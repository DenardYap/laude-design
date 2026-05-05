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

// Catalog of selectable models. Ordered newest-first within each provider so
// the first entry in the list is the sensible default. Curated to the current
// generation only — older / deprecated IDs are dropped on each refresh.
export const MODEL_OPTIONS: ModelOption[] = [
  // ------- Anthropic / Claude -------
  {
    provider: "CLAUDE",
    modelId: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Best for design — balanced & capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "CLAUDE",
    modelId: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    description: "Most capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "CLAUDE",
    modelId: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Fast & cheap",
    contextWindow: 200_000,
  },

  // ------- OpenAI -------
  {
    provider: "OPENAI",
    modelId: "gpt-5.5",
    label: "GPT-5.5",
    description: "Most capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "OPENAI",
    modelId: "gpt-5.4",
    label: "GPT-5.4",
    description: "Smart & fast",
    contextWindow: 1_000_000,
  },
  {
    provider: "OPENAI",
    modelId: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description: "Fastest & cheapest",
    contextWindow: 400_000,
  },

  // ------- Google / Gemini -------
  {
    provider: "GEMINI",
    modelId: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    description: "Most capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "GEMINI",
    modelId: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    description: "Fast",
    contextWindow: 1_000_000,
  },
  {
    provider: "GEMINI",
    modelId: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite",
    description: "Cheapest",
    contextWindow: 1_000_000,
  },
];

// Conservative fallback for any modelId we don't have an explicit entry for.
// Most modern models clear this; older / unknown IDs land here.
const FALLBACK_CONTEXT_WINDOW = 32_000;

export function getContextWindow(provider: ModelProvider, modelId: string): number {
  const match = MODEL_OPTIONS.find(
    (m) => m.provider === provider && m.modelId === modelId,
  );
  return match?.contextWindow ?? FALLBACK_CONTEXT_WINDOW;
}

// Resolves a (possibly stale) persisted selection to a current catalog entry.
// When the catalog is refreshed we drop deprecated model IDs; any user with a
// retired ID in their persisted store falls back to the default model so we
// never send a 404-ing model string to the provider.
export function resolveModelOption(
  selected: { provider: string; modelId: string } | undefined,
): ModelOption {
  if (!selected) return MODEL_OPTIONS[0];
  return (
    MODEL_OPTIONS.find(
      (m) => m.provider === selected.provider && m.modelId === selected.modelId,
    ) ?? MODEL_OPTIONS[0]
  );
}

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  CLAUDE: "Anthropic",
  OPENAI: "OpenAI",
  GEMINI: "Google",
};

// Stable display order for providers (matches MODEL_OPTIONS grouping).
export const PROVIDER_ORDER: readonly ModelProvider[] = ["CLAUDE", "OPENAI", "GEMINI"] as const;

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

