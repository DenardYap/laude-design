import { describe, expect, it } from "vitest";

import { calculateCost, getModelPricing } from "./pricing";

describe("getModelPricing", () => {
  it("returns pricing for a known Claude model", () => {
    const pricing = getModelPricing("CLAUDE", "claude-sonnet-4-6");
    expect(pricing).not.toBeNull();
    expect(pricing!.inputUsdPer1M).toBe(3);
    expect(pricing!.outputUsdPer1M).toBe(15);
  });

  it("returns pricing for a known OpenAI model", () => {
    const pricing = getModelPricing("OPENAI", "gpt-5.5");
    expect(pricing).not.toBeNull();
    expect(pricing!.inputUsdPer1M).toBe(5);
    expect(pricing!.outputUsdPer1M).toBe(30);
  });

  it("returns pricing for a known Gemini model", () => {
    const pricing = getModelPricing("GEMINI", "gemini-3-flash-preview");
    expect(pricing).not.toBeNull();
    expect(pricing!.inputUsdPer1M).toBe(0.5);
    expect(pricing!.outputUsdPer1M).toBe(3);
  });

  it("returns null for an unknown model within a known provider", () => {
    expect(getModelPricing("CLAUDE", "claude-totally-fake")).toBeNull();
  });

  it("returns null for an unknown provider/model combination", () => {
    expect(getModelPricing("CLAUDE", "gpt-5.5")).toBeNull();
    expect(getModelPricing("OPENAI", "claude-sonnet-4-6")).toBeNull();
  });

  it("returns pricing for every model in the catalog", () => {
    const knownModels: Array<{ provider: "CLAUDE" | "OPENAI" | "GEMINI"; modelId: string }> = [
      { provider: "CLAUDE", modelId: "claude-sonnet-4-6" },
      { provider: "CLAUDE", modelId: "claude-opus-4-7" },
      { provider: "CLAUDE", modelId: "claude-haiku-4-5" },
      { provider: "OPENAI", modelId: "gpt-5.5" },
      { provider: "OPENAI", modelId: "gpt-5.4" },
      { provider: "OPENAI", modelId: "gpt-5.4-mini" },
      { provider: "GEMINI", modelId: "gemini-3.1-pro-preview" },
      { provider: "GEMINI", modelId: "gemini-3-flash-preview" },
      { provider: "GEMINI", modelId: "gemini-3.1-flash-lite-preview" },
    ];

    for (const { provider, modelId } of knownModels) {
      const pricing = getModelPricing(provider, modelId);
      expect(pricing, `${provider}/${modelId} should have pricing`).not.toBeNull();
      expect(pricing!.inputUsdPer1M).toBeGreaterThan(0);
      expect(pricing!.outputUsdPer1M).toBeGreaterThan(0);
    }
  });

  it("output price is always higher than input price (models charge more for output)", () => {
    const models = [
      { provider: "CLAUDE" as const, modelId: "claude-sonnet-4-6" },
      { provider: "OPENAI" as const, modelId: "gpt-5.5" },
      { provider: "GEMINI" as const, modelId: "gemini-3.1-pro-preview" },
    ];

    for (const { provider, modelId } of models) {
      const p = getModelPricing(provider, modelId)!;
      expect(p.outputUsdPer1M, `${provider}/${modelId} output > input`).toBeGreaterThan(
        p.inputUsdPer1M,
      );
    }
  });

  it("every model in the catalog declares a cache-read rate", () => {
    // Without `cacheReadUsdPer1M` the provider's cache discount silently
    // collapses into the flat input rate inside `calculateCost`, so it's
    // worth asserting that every catalog entry opts in.
    const all: Array<{ provider: "CLAUDE" | "OPENAI" | "GEMINI"; modelId: string }> = [
      { provider: "CLAUDE", modelId: "claude-sonnet-4-6" },
      { provider: "CLAUDE", modelId: "claude-opus-4-7" },
      { provider: "CLAUDE", modelId: "claude-haiku-4-5" },
      { provider: "OPENAI", modelId: "gpt-5.5" },
      { provider: "OPENAI", modelId: "gpt-5.4" },
      { provider: "OPENAI", modelId: "gpt-5.4-mini" },
      { provider: "GEMINI", modelId: "gemini-3.1-pro-preview" },
      { provider: "GEMINI", modelId: "gemini-3-flash-preview" },
      { provider: "GEMINI", modelId: "gemini-3.1-flash-lite-preview" },
    ];
    for (const { provider, modelId } of all) {
      const p = getModelPricing(provider, modelId)!;
      expect(p.cacheReadUsdPer1M, `${provider}/${modelId} cache read rate`).toBeGreaterThan(0);
      expect(p.cacheReadUsdPer1M, `${provider}/${modelId} cache read < input`).toBeLessThan(
        p.inputUsdPer1M,
      );
    }
  });

  it("only Anthropic models declare a cache-write rate (OpenAI/Gemini cache writes are free)", () => {
    const claude = getModelPricing("CLAUDE", "claude-haiku-4-5")!;
    expect(claude.cacheWriteUsdPer1M).toBeDefined();
    expect(claude.cacheWriteUsdPer1M).toBeGreaterThan(claude.inputUsdPer1M);

    const openai = getModelPricing("OPENAI", "gpt-5.5")!;
    expect(openai.cacheWriteUsdPer1M).toBeUndefined();

    const gemini = getModelPricing("GEMINI", "gemini-3.1-pro-preview")!;
    expect(gemini.cacheWriteUsdPer1M).toBeUndefined();
  });
});

describe("calculateCost", () => {
  const pricing = { inputUsdPer1M: 3, outputUsdPer1M: 15 };
  const pricingWithCache = {
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    cacheWriteUsdPer1M: 3.75,
    cacheReadUsdPer1M: 0.3,
  };

  it("calculates cost correctly for a typical usage", () => {
    // 1000 input tokens × $3/1M + 500 output tokens × $15/1M
    // = 0.003 + 0.0075 = 0.0105
    const cost = calculateCost({ inputTokens: 1000, outputTokens: 500 }, pricing);
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateCost({ inputTokens: 0, outputTokens: 0 }, pricing)).toBe(0);
  });

  it("treats undefined inputTokens as 0", () => {
    const cost = calculateCost({ outputTokens: 1_000_000 }, pricing);
    expect(cost).toBeCloseTo(15, 6);
  });

  it("treats undefined outputTokens as 0", () => {
    const cost = calculateCost({ inputTokens: 1_000_000 }, pricing);
    expect(cost).toBeCloseTo(3, 6);
  });

  it("treats both tokens undefined as 0 total cost", () => {
    expect(calculateCost({}, pricing)).toBe(0);
  });

  it("scales linearly with token count", () => {
    const costAt1M = calculateCost({ inputTokens: 1_000_000, outputTokens: 0 }, pricing);
    const costAt2M = calculateCost({ inputTokens: 2_000_000, outputTokens: 0 }, pricing);
    expect(costAt2M).toBeCloseTo(costAt1M * 2, 6);
  });

  it("handles large token counts without overflow", () => {
    // 100 million tokens — large but plausible for a long agentic session
    const cost = calculateCost(
      { inputTokens: 100_000_000, outputTokens: 100_000_000 },
      pricing,
    );
    expect(cost).toBeCloseTo(100 * 3 + 100 * 15, 2);
  });

  it("rounds to a reasonable number of decimal places via floating point", () => {
    const cost = calculateCost({ inputTokens: 1, outputTokens: 1 }, pricing);
    // 1 token × $3/1M = $0.000003; 1 token × $15/1M = $0.000015
    expect(cost).toBeCloseTo(0.000018, 8);
  });

  it("is additive — computing input and output separately matches combined", () => {
    const combined = calculateCost({ inputTokens: 500, outputTokens: 300 }, pricing);
    const inputOnly = calculateCost({ inputTokens: 500, outputTokens: 0 }, pricing);
    const outputOnly = calculateCost({ inputTokens: 0, outputTokens: 300 }, pricing);
    expect(combined).toBeCloseTo(inputOnly + outputOnly, 10);
  });

  describe("Anthropic prompt-cache differential pricing", () => {
    it("applies per-type rates when all three token buckets are provided", () => {
      // 800k no-cache @ $3/1M = $2.40
      // 100k cache-write @ $3.75/1M = $0.375
      // 100k cache-read @ $0.30/1M = $0.03
      // 500k output @ $15/1M = $7.50
      const cost = calculateCost(
        {
          outputTokens: 500_000,
          noCacheInputTokens: 800_000,
          cacheWriteInputTokens: 100_000,
          cacheReadInputTokens: 100_000,
        },
        pricingWithCache,
      );
      expect(cost).toBeCloseTo(2.4 + 0.375 + 0.03 + 7.5, 6);
    });

    it("falls back to flat rate when the breakdown is missing", () => {
      const cost = calculateCost(
        { inputTokens: 1_000_000, outputTokens: 0 },
        pricingWithCache,
      );
      expect(cost).toBeCloseTo(3, 6);
    });

    it("cache-read-heavy session is cheaper than flat estimate", () => {
      const cacheHeavy = calculateCost(
        {
          outputTokens: 0,
          noCacheInputTokens: 50_000,
          cacheReadInputTokens: 900_000,
          cacheWriteInputTokens: 50_000,
        },
        pricingWithCache,
      );
      const flat = calculateCost({ inputTokens: 1_000_000, outputTokens: 0 }, pricingWithCache);
      expect(cacheHeavy).toBeLessThan(flat);
    });

    it("cache-write-heavy session is more expensive than flat estimate", () => {
      const writeHeavy = calculateCost(
        {
          outputTokens: 0,
          noCacheInputTokens: 50_000,
          cacheWriteInputTokens: 950_000,
          cacheReadInputTokens: 0,
        },
        pricingWithCache,
      );
      const flat = calculateCost({ inputTokens: 1_000_000, outputTokens: 0 }, pricingWithCache);
      expect(writeHeavy).toBeGreaterThan(flat);
    });

    it("treats missing buckets as zero without throwing", () => {
      expect(() =>
        calculateCost(
          {
            outputTokens: 0,
            noCacheInputTokens: 1_000,
          },
          pricingWithCache,
        ),
      ).not.toThrow();
    });
  });

  describe("OpenAI cache pricing (cacheRead only, no cacheWrite fee)", () => {
    // OpenAI auto-caches prefixes ≥1024 tokens. The provider never reports
    // `cacheWriteTokens` because writes are free — `calculateCost` should
    // bill cache writes (if ever set) at the regular input rate.
    const openaiPricing = getModelPricing("OPENAI", "gpt-5.4")!;

    it("applies the cache-read discount when AI SDK reports cached tokens", () => {
      // 1M total input split as 600k fresh + 400k cached
      // = 600k × $2.50/1M  + 400k × $1.25/1M  (cache-read discount)
      // = $1.50           + $0.50
      // = $2.00 input, plus 0 output
      const cost = calculateCost(
        {
          inputTokens: 1_000_000,
          outputTokens: 0,
          noCacheInputTokens: 600_000,
          cacheReadInputTokens: 400_000,
          // OpenAI never sets this, but we assert behavior just in case
          cacheWriteInputTokens: undefined,
        },
        openaiPricing,
      );
      expect(cost).toBeCloseTo(1.5 + 0.5, 6);
    });

    it("a cached-heavy turn costs less than the same tokens billed flat", () => {
      const cached = calculateCost(
        {
          outputTokens: 0,
          noCacheInputTokens: 100_000,
          cacheReadInputTokens: 900_000,
        },
        openaiPricing,
      );
      const flat = calculateCost({ inputTokens: 1_000_000, outputTokens: 0 }, openaiPricing);
      expect(cached).toBeLessThan(flat);
    });

    it("falls back to flat rate when AI SDK reports no breakdown", () => {
      // OpenAI reports no `cached_tokens` for prompts under the cache
      // threshold — the breakdown fields will be undefined and we should
      // bill at the regular input rate.
      const cost = calculateCost(
        { inputTokens: 500_000, outputTokens: 0 },
        openaiPricing,
      );
      expect(cost).toBeCloseTo((500_000 / 1_000_000) * openaiPricing.inputUsdPer1M, 6);
    });
  });

  describe("Gemini cache pricing (implicit caching, cacheRead only)", () => {
    // Gemini 2.5+ auto-applies implicit caching for any sufficiently long
    // prefix and reports the discount via `cachedContentTokenCount`,
    // normalized into `cacheReadTokens` by the AI SDK.
    const geminiPricing = getModelPricing("GEMINI", "gemini-3.1-pro-preview")!;

    it("applies the implicit cache-read discount", () => {
      // 1M total input split as 700k fresh + 300k cached
      // = 700k × $2/1M  + 300k × $0.50/1M
      // = $1.40        + $0.15
      // = $1.55 input
      const cost = calculateCost(
        {
          inputTokens: 1_000_000,
          outputTokens: 0,
          noCacheInputTokens: 700_000,
          cacheReadInputTokens: 300_000,
        },
        geminiPricing,
      );
      expect(cost).toBeCloseTo(1.4 + 0.15, 6);
    });

    it("falls back to flat rate when no caching is reported", () => {
      const cost = calculateCost(
        { inputTokens: 100_000, outputTokens: 50_000 },
        geminiPricing,
      );
      expect(cost).toBeCloseTo(
        (100_000 / 1_000_000) * geminiPricing.inputUsdPer1M +
          (50_000 / 1_000_000) * geminiPricing.outputUsdPer1M,
        6,
      );
    });
  });

  describe("calculateCost invariants across providers", () => {
    // For ANY provider, splitting the same total input across cache buckets
    // should never charge MORE than the flat-rate equivalent — caching is
    // either free (breakeven) or a discount, but never a penalty.
    // Exception: Anthropic cache writes ARE more expensive (1.25× input),
    // so this invariant only holds for cache-read-only splits.
    const allReadOnly = [
      { provider: "OPENAI" as const, modelId: "gpt-5.4" },
      { provider: "OPENAI" as const, modelId: "gpt-5.5" },
      { provider: "GEMINI" as const, modelId: "gemini-3.1-pro-preview" },
      { provider: "GEMINI" as const, modelId: "gemini-3-flash-preview" },
    ];

    for (const { provider, modelId } of allReadOnly) {
      it(`${provider}/${modelId}: cache-read-heavy split is cheaper than flat`, () => {
        const p = getModelPricing(provider, modelId)!;
        const cached = calculateCost(
          {
            outputTokens: 0,
            noCacheInputTokens: 100_000,
            cacheReadInputTokens: 900_000,
          },
          p,
        );
        const flat = calculateCost(
          { inputTokens: 1_000_000, outputTokens: 0 },
          p,
        );
        expect(cached).toBeLessThan(flat);
      });

      it(`${provider}/${modelId}: noCache + cacheRead bucket sum equals flat when cacheRead=0`, () => {
        const p = getModelPricing(provider, modelId)!;
        const breakdown = calculateCost(
          {
            outputTokens: 0,
            noCacheInputTokens: 1_000_000,
            cacheReadInputTokens: 0,
          },
          p,
        );
        const flat = calculateCost(
          { inputTokens: 1_000_000, outputTokens: 0 },
          p,
        );
        expect(breakdown).toBeCloseTo(flat, 6);
      });
    }

    it("Anthropic invariant: bucket sum equals flat when ALL tokens are noCache", () => {
      // The current bug-detection canary: if cumulativeInputTokens grew by
      // 354,297 and cost matched 354,297 × $1/M (Haiku 4.5 input rate),
      // that uniquely implies all tokens were billed at the no-cache rate.
      const p = getModelPricing("CLAUDE", "claude-haiku-4-5")!;
      const breakdown = calculateCost(
        {
          outputTokens: 766,
          noCacheInputTokens: 354_297,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        },
        p,
      );
      // Should match the user's observed $0.358127 from the screenshot.
      expect(breakdown).toBeCloseTo(0.358127, 5);
    });

    it("Anthropic with caching: same conversation costs less", () => {
      // Same 354k input, but if half were cache reads (10% rate) the cost
      // should drop substantially — proves caching propagates through.
      const p = getModelPricing("CLAUDE", "claude-haiku-4-5")!;
      const cached = calculateCost(
        {
          outputTokens: 766,
          noCacheInputTokens: 177_148,
          cacheReadInputTokens: 177_149,
          cacheWriteInputTokens: 0,
        },
        p,
      );
      const flat = calculateCost(
        {
          outputTokens: 766,
          noCacheInputTokens: 354_297,
          cacheReadInputTokens: 0,
          cacheWriteInputTokens: 0,
        },
        p,
      );
      expect(cached).toBeLessThan(flat);
      // 50% cache reads at 10% of base rate should give roughly a 45% saving
      expect(cached / flat).toBeLessThan(0.6);
      expect(cached / flat).toBeGreaterThan(0.5);
    });
  });
});
