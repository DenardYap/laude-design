import { describe, expect, it, vi } from "vitest";

// Mock the AI SDK provider constructors — we're testing our wrapper logic, not
// the SDKs themselves.
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => ({ provider: "claude-mock" }))),
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ provider: "openai-mock" }))),
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({ provider: "gemini-mock" }))),
}));

import { resolveModel, MissingApiKeyError } from "./providers";

describe("resolveModel", () => {
  it("throws MissingApiKeyError when apiKey is empty", () => {
    expect(() => resolveModel("CLAUDE", "claude-haiku-4-5", "")).toThrow(
      MissingApiKeyError,
    );
  });

  it("throws MissingApiKeyError when apiKey is only whitespace", () => {
    expect(() => resolveModel("OPENAI", "gpt-5.4-mini", "   ")).toThrow(
      MissingApiKeyError,
    );
  });

  it("returns a model object for CLAUDE with a valid key", () => {
    const model = resolveModel("CLAUDE", "claude-haiku-4-5", "sk-ant-test");
    expect(model).toBeDefined();
  });

  it("returns a model object for OPENAI with a valid key", () => {
    const model = resolveModel("OPENAI", "gpt-5.4-mini", "sk-test");
    expect(model).toBeDefined();
  });

  it("returns a model object for GEMINI with a valid key", () => {
    const model = resolveModel("GEMINI", "gemini-2.5-flash-lite", "AIzatest");
    expect(model).toBeDefined();
  });

  it("MissingApiKeyError has the correct provider set", () => {
    try {
      resolveModel("GEMINI", "gemini-2.5-flash-lite", "");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingApiKeyError);
      expect((err as MissingApiKeyError).provider).toBe("GEMINI");
    }
  });
});
