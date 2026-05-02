import type { ModelProvider } from "@/lib/workspace/types";

export interface ModelPricing {
  // USD per 1,000,000 tokens for prompt (input) tokens.
  inputUsdPer1M: number;
  // USD per 1,000,000 tokens for completion (output) tokens.
  outputUsdPer1M: number;
}

// Public list-pricing per (provider, modelId). Sourced from each provider's
// public pricing page. Update here when pricing changes; the chat route reads
// from this map only — no other call site should hardcode rates.
//
// Auxiliary internal calls (titler, summarizer) are intentionally NOT counted
// toward session cost; those models are tiny and the user opted to scope cost
// tracking to the main chat model only.
// Gemini 3.1 Pro has tiered pricing ($2 / $12 ≤200k, $4 / $18 >200k); we list
// the ≤200k rate, matching how the previous Gemini 2.5 Pro entry was priced.
const MODEL_PRICING: Record<ModelProvider, Record<string, ModelPricing>> = {
  CLAUDE: {
    "claude-sonnet-4-6": { inputUsdPer1M: 3, outputUsdPer1M: 15 },
    "claude-opus-4-7": { inputUsdPer1M: 5, outputUsdPer1M: 25 },
    "claude-haiku-4-5": { inputUsdPer1M: 1, outputUsdPer1M: 5 },
  },
  OPENAI: {
    "gpt-5.5": { inputUsdPer1M: 5, outputUsdPer1M: 30 },
    "gpt-5.4": { inputUsdPer1M: 2.5, outputUsdPer1M: 15 },
    "gpt-5.4-mini": { inputUsdPer1M: 0.75, outputUsdPer1M: 4.5 },
  },
  GEMINI: {
    "gemini-3.1-pro-preview": { inputUsdPer1M: 2, outputUsdPer1M: 12 },
    "gemini-3-flash-preview": { inputUsdPer1M: 0.5, outputUsdPer1M: 3 },
    "gemini-3.1-flash-lite-preview": { inputUsdPer1M: 0.25, outputUsdPer1M: 1.5 },
  },
};

export function getModelPricing(
  provider: ModelProvider,
  modelId: string,
): ModelPricing | null {
  return MODEL_PRICING[provider]?.[modelId] ?? null;
}

export function calculateCost(
  usage: { inputTokens?: number; outputTokens?: number },
  pricing: ModelPricing,
): number {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  return (
    (input / 1_000_000) * pricing.inputUsdPer1M +
    (output / 1_000_000) * pricing.outputUsdPer1M
  );
}
