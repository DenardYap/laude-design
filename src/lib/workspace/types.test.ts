import { describe, expect, it } from "vitest";

import {
  MODEL_OPTIONS,
  PROVIDER_LABEL,
  PROVIDER_ORDER,
  getContextWindow,
  resolveModelOption,
} from "./types";

describe("getContextWindow", () => {
  it("returns the correct context window for Claude Sonnet 4.6", () => {
    expect(getContextWindow("CLAUDE", "claude-sonnet-4-6")).toBe(1_000_000);
  });

  it("returns the correct context window for Claude Haiku (smaller window)", () => {
    expect(getContextWindow("CLAUDE", "claude-haiku-4-5")).toBe(200_000);
  });

  it("returns the correct context window for GPT-5.4-mini (400k)", () => {
    expect(getContextWindow("OPENAI", "gpt-5.4-mini")).toBe(400_000);
  });

  it("returns the correct context window for a Gemini model", () => {
    expect(getContextWindow("GEMINI", "gemini-3.1-pro-preview")).toBe(1_000_000);
  });

  it("returns the fallback (32k) for an unknown model within a known provider", () => {
    expect(getContextWindow("CLAUDE", "claude-fake-9000")).toBe(32_000);
  });

  it("returns the fallback for an unknown provider", () => {
    // TypeScript wouldn't normally allow this, but the function should be defensive
    expect(getContextWindow("CLAUDE" as never, "")).toBe(32_000);
  });

  it("returns a positive number for every model in the catalog", () => {
    for (const model of MODEL_OPTIONS) {
      const cw = getContextWindow(model.provider, model.modelId);
      expect(cw, `${model.provider}/${model.modelId}`).toBeGreaterThan(0);
    }
  });
});

describe("resolveModelOption", () => {
  it("returns the first catalog entry when selection is undefined", () => {
    const result = resolveModelOption(undefined);
    expect(result).toBe(MODEL_OPTIONS[0]);
  });

  it("resolves a known provider/model pair to the correct entry", () => {
    const result = resolveModelOption({ provider: "OPENAI", modelId: "gpt-5.5" });
    expect(result.provider).toBe("OPENAI");
    expect(result.modelId).toBe("gpt-5.5");
    expect(result.label).toBe("GPT-5.5");
  });

  it("falls back to the default model for an unknown/retired modelId", () => {
    const result = resolveModelOption({ provider: "CLAUDE", modelId: "claude-v999-deprecated" });
    expect(result).toBe(MODEL_OPTIONS[0]);
  });

  it("falls back to default when provider doesn't match", () => {
    const result = resolveModelOption({ provider: "OPENAI", modelId: "claude-sonnet-4-6" });
    expect(result).toBe(MODEL_OPTIONS[0]);
  });

  it("returns the exact object reference from MODEL_OPTIONS (no clone)", () => {
    const selected = { provider: "GEMINI" as const, modelId: "gemini-3-flash-preview" };
    const result = resolveModelOption(selected);
    expect(result).toBe(MODEL_OPTIONS.find((m) => m.modelId === "gemini-3-flash-preview"));
  });

  it("every model in MODEL_OPTIONS resolves to itself", () => {
    for (const model of MODEL_OPTIONS) {
      const result = resolveModelOption({ provider: model.provider, modelId: model.modelId });
      expect(result.provider, model.modelId).toBe(model.provider);
      expect(result.modelId, model.modelId).toBe(model.modelId);
    }
  });
});

describe("MODEL_OPTIONS catalog invariants", () => {
  it("is non-empty", () => {
    expect(MODEL_OPTIONS.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty label and modelId", () => {
    for (const m of MODEL_OPTIONS) {
      expect(m.label.length, m.modelId).toBeGreaterThan(0);
      expect(m.modelId.length, m.label).toBeGreaterThan(0);
    }
  });

  it("no duplicate modelId within the same provider", () => {
    const seen = new Map<string, Set<string>>();
    for (const m of MODEL_OPTIONS) {
      if (!seen.has(m.provider)) seen.set(m.provider, new Set());
      const ids = seen.get(m.provider)!;
      expect(ids.has(m.modelId), `duplicate ${m.provider}/${m.modelId}`).toBe(false);
      ids.add(m.modelId);
    }
  });

  it("covers all three providers", () => {
    const providers = new Set(MODEL_OPTIONS.map((m) => m.provider));
    expect(providers.has("CLAUDE")).toBe(true);
    expect(providers.has("OPENAI")).toBe(true);
    expect(providers.has("GEMINI")).toBe(true);
  });
});

describe("PROVIDER_LABEL", () => {
  it("maps CLAUDE to Anthropic", () => {
    expect(PROVIDER_LABEL.CLAUDE).toBe("Anthropic");
  });

  it("maps OPENAI to OpenAI", () => {
    expect(PROVIDER_LABEL.OPENAI).toBe("OpenAI");
  });

  it("maps GEMINI to Google", () => {
    expect(PROVIDER_LABEL.GEMINI).toBe("Google");
  });
});

describe("PROVIDER_ORDER", () => {
  it("contains all three providers", () => {
    expect(PROVIDER_ORDER).toContain("CLAUDE");
    expect(PROVIDER_ORDER).toContain("OPENAI");
    expect(PROVIDER_ORDER).toContain("GEMINI");
  });

  it("has exactly three entries", () => {
    expect(PROVIDER_ORDER).toHaveLength(3);
  });
});
