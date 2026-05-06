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
