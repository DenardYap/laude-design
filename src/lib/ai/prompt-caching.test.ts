import { describe, expect, it } from "vitest";

import {
  buildCacheableSystemPrompt,
  withCachedToolPrefix,
} from "./prompt-caching";

const ANTHROPIC_EPHEMERAL = {
  anthropic: { cacheControl: { type: "ephemeral" } },
};

describe("buildCacheableSystemPrompt", () => {
  it("emits a single cacheable block when no summary is present", () => {
    const result = buildCacheableSystemPrompt({
      stable: "You are a helpful assistant.",
      summary: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
      providerOptions: ANTHROPIC_EPHEMERAL,
    });
  });

  it("emits two blocks when a summary is present, with cache marker only on the stable block", () => {
    const result = buildCacheableSystemPrompt({
      stable: "stable system text",
      summary: "earlier conversation about X, Y, Z",
    });
    expect(result).toHaveLength(2);
    expect(result[0].providerOptions).toEqual(ANTHROPIC_EPHEMERAL);
    // The summary block must NOT carry a cache marker, otherwise summary
    // edits would invalidate the cached prefix on every summarization.
    expect(result[1].providerOptions).toBeUndefined();
    expect(result[1].content).toContain("earlier conversation about X, Y, Z");
    expect(result[1].content).toContain("Earlier conversation summary");
  });

  it("treats empty summary string as no summary (single cacheable block)", () => {
    const result = buildCacheableSystemPrompt({
      stable: "system",
      summary: "",
    });
    expect(result).toHaveLength(1);
  });

  it("preserves stable content byte-for-byte across calls (cache key stability)", () => {
    // The cache only hits when the prefix bytes match exactly. If we
    // accidentally trim, lowercase, or otherwise mutate the stable block,
    // every turn becomes a cache miss. Lock in identity here.
    const STABLE = "  Whitespace-sensitive\n  multiline content  ";
    const a = buildCacheableSystemPrompt({ stable: STABLE, summary: null });
    const b = buildCacheableSystemPrompt({ stable: STABLE, summary: "fresh" });
    expect(a[0].content).toBe(STABLE);
    expect(b[0].content).toBe(STABLE);
    expect(a[0].content).toBe(b[0].content);
  });
});

describe("withCachedToolPrefix", () => {
  // Minimal Tool-shaped object — we only care about the providerOptions
  // surgery, not the actual tool execution wiring.
  const stubTool = (description: string) => ({
    description,
    inputSchema: { type: "object" as const },
  });

  it("returns the input unchanged when there are no tools", () => {
    const result = withCachedToolPrefix({});
    expect(result).toEqual({});
  });

  it("attaches Anthropic cache marker to the LAST tool in insertion order", () => {
    const tools = {
      first: stubTool("first tool"),
      second: stubTool("second tool"),
      third: stubTool("third tool"),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = withCachedToolPrefix(tools as any);

    // First/middle tools are untouched
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.first as any).providerOptions).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.second as any).providerOptions).toBeUndefined();
    // Last tool gets the marker
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.third as any).providerOptions).toEqual(ANTHROPIC_EPHEMERAL);
  });

  it("preserves existing providerOptions while merging in the Anthropic marker", () => {
    const tools = {
      single: {
        ...stubTool("only tool"),
        providerOptions: {
          openai: { someExistingOption: true },
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = withCachedToolPrefix(tools as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.single as any).providerOptions).toEqual({
      openai: { someExistingOption: true },
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("does not mutate the original tools object", () => {
    const tools = {
      a: stubTool("a"),
      b: stubTool("b"),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withCachedToolPrefix(tools as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tools.a as any).providerOptions).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tools.b as any).providerOptions).toBeUndefined();
  });

  it("uses only one cache breakpoint regardless of how many tools are passed", () => {
    // Anthropic caps at 4 cache breakpoints per request. Combined with the
    // 1 marker on the system block, we want at most 1 marker on tools to
    // stay well under the cap and leave headroom for future per-message
    // markers.
    const manyTools = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`tool${i}`, stubTool(`t${i}`)]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = withCachedToolPrefix(manyTools as any);
    const markedCount = Object.values(result).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => t.providerOptions?.anthropic?.cacheControl,
    ).length;
    expect(markedCount).toBe(1);
  });
});
