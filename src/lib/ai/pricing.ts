import type { ModelProvider } from "@/lib/workspace/types";

export interface ModelPricing {
  // USD per 1,000,000 tokens for regular (no-cache) prompt tokens.
  inputUsdPer1M: number;
  // USD per 1,000,000 tokens for completion (output) tokens.
  outputUsdPer1M: number;
  // USD per 1,000,000 tokens for prompt-cache write tokens.
  // - Anthropic: 1.25× input (cache writes are billed at a premium).
  // - OpenAI / Gemini: undefined — neither provider charges a separate write
  //   fee, so the first time a prefix is sent it bills at the regular input
  //   rate. `calculateCost` falls back to `inputUsdPer1M` when this is unset.
  cacheWriteUsdPer1M?: number;
  // USD per 1,000,000 tokens for prompt-cache read tokens. Required to
  // enable per-bucket cache pricing in `calculateCost`.
  // - Anthropic: 0.10× input (10% of base rate).
  // - OpenAI:    0.50× input (50% discount, applies to GPT-4o family and
  //              the GPT-5 generation in this catalog).
  // - Gemini 2.5+: 0.25× input (75% discount, implicit caching rate).
  cacheReadUsdPer1M?: number;
}

// Public list-pricing per (provider, modelId). Sourced from each provider's
// public pricing page. Update here when pricing changes; the chat route reads
// from this map only — no other call site should hardcode rates.
//
// Auxiliary internal calls (titler, summarizer) are intentionally NOT counted
// toward session cost; those models are tiny and the user opted to scope cost
// tracking to the main chat model only.
//
// Cache-rate references (verify against current public pricing pages):
//   Anthropic: https://www.anthropic.com/pricing#api
//     cache write = 1.25× the base input rate
//     cache read  = 0.10× the base input rate
//   OpenAI:    https://openai.com/api/pricing/
//     cached input ≈ 0.50× the base input rate (GPT-4o family + GPT-5)
//   Google:    https://ai.google.dev/pricing
//     implicit cached input ≈ 0.25× the base input rate (Gemini 2.5+)
const MODEL_PRICING: Record<ModelProvider, Record<string, ModelPricing>> = {
  CLAUDE: {
    "claude-sonnet-4-6": {
      inputUsdPer1M: 3,
      outputUsdPer1M: 15,
      cacheWriteUsdPer1M: 3.75,
      cacheReadUsdPer1M: 0.3,
    },
    "claude-opus-4-7": {
      inputUsdPer1M: 5,
      outputUsdPer1M: 25,
      cacheWriteUsdPer1M: 6.25,
      cacheReadUsdPer1M: 0.5,
    },
    "claude-haiku-4-5": {
      inputUsdPer1M: 1,
      outputUsdPer1M: 5,
      cacheWriteUsdPer1M: 1.25,
      cacheReadUsdPer1M: 0.1,
    },
  },
  OPENAI: {
    "gpt-5.5": {
      inputUsdPer1M: 5,
      outputUsdPer1M: 30,
      cacheReadUsdPer1M: 2.5,
    },
    "gpt-5.4": {
      inputUsdPer1M: 2.5,
      outputUsdPer1M: 15,
      cacheReadUsdPer1M: 1.25,
    },
    "gpt-5.4-mini": {
      inputUsdPer1M: 0.75,
      outputUsdPer1M: 4.5,
      cacheReadUsdPer1M: 0.375,
    },
  },
  GEMINI: {
    "gemini-3.1-pro-preview": {
      inputUsdPer1M: 2,
      outputUsdPer1M: 12,
      cacheReadUsdPer1M: 0.5,
    },
    "gemini-3-flash-preview": {
      inputUsdPer1M: 0.5,
      outputUsdPer1M: 3,
      cacheReadUsdPer1M: 0.125,
    },
    "gemini-3.1-flash-lite-preview": {
      inputUsdPer1M: 0.25,
      outputUsdPer1M: 1.5,
      cacheReadUsdPer1M: 0.0625,
    },
  },
};

export function getModelPricing(
  provider: ModelProvider,
  modelId: string,
): ModelPricing | null {
  return MODEL_PRICING[provider]?.[modelId] ?? null;
}

/**
 * Calculate the cost of a generation in USD.
 *
 * AI SDK v5 normalizes prompt-cache reporting across providers into the
 * same `inputTokenDetails` shape (see `convert-anthropic-messages-usage`,
 * `convert-openai-usage`, `convert-google-generative-ai-usage`):
 *
 *   - `noCacheTokens`    → tokens billed at the regular input rate
 *   - `cacheWriteTokens` → tokens billed at the cache-write rate (Anthropic
 *                          only; OpenAI/Gemini cache writes are free, so
 *                          the provider always reports `undefined` here).
 *   - `cacheReadTokens`  → tokens billed at the cache-read rate (all three
 *                          providers report this when caching is active).
 *
 * Invariant: noCache + cacheRead + cacheWrite = the provider's reported
 * gross `inputTokens`. We rely on this so a provider that omits the
 * breakdown (or one whose pricing entry doesn't list a cache rate) cleanly
 * falls back to the flat input rate × `inputTokens`.
 */
export function calculateCost(
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    noCacheInputTokens?: number;
    cacheReadInputTokens?: number;
    cacheWriteInputTokens?: number;
  },
  pricing: ModelPricing,
): number {
  const output = usage.outputTokens ?? 0;
  const outputCost = (output / 1_000_000) * pricing.outputUsdPer1M;

  // Per-bucket pricing requires (a) a documented cache-read rate AND (b) at
  // least one of the breakdown fields being present. If either is missing
  // we fall back to charging the gross `inputTokens` at the regular input
  // rate — that's always a safe upper bound.
  const hasCacheBreakdown =
    pricing.cacheReadUsdPer1M !== undefined &&
    (usage.noCacheInputTokens !== undefined ||
      usage.cacheReadInputTokens !== undefined ||
      usage.cacheWriteInputTokens !== undefined);

  if (hasCacheBreakdown) {
    const noCache = usage.noCacheInputTokens ?? 0;
    const cacheRead = usage.cacheReadInputTokens ?? 0;
    const cacheWrite = usage.cacheWriteInputTokens ?? 0;
    // Providers without a separate cache-write fee (OpenAI auto-cache,
    // Gemini implicit cache) effectively bill the first send at the
    // regular input rate. Substitute that rate so we don't accidentally
    // multiply by `undefined` if a future provider starts reporting
    // `cacheWriteTokens` without us having set a cache-write rate.
    const writeRate = pricing.cacheWriteUsdPer1M ?? pricing.inputUsdPer1M;
    return (
      (noCache / 1_000_000) * pricing.inputUsdPer1M +
      (cacheWrite / 1_000_000) * writeRate +
      (cacheRead / 1_000_000) * pricing.cacheReadUsdPer1M! +
      outputCost
    );
  }

  const totalInput = usage.inputTokens ?? 0;
  return (totalInput / 1_000_000) * pricing.inputUsdPer1M + outputCost;
}
