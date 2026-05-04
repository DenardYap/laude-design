import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";

import { estimateTokens } from "./context-summarizer";

// Helpers to build ModelMessage fixtures without depending on the AI SDK internals
function userMsg(content: string | object): ModelMessage {
  if (typeof content === "string") {
    return { role: "user", content };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { role: "user", content: content as any };
}

function assistantMsg(content: string): ModelMessage {
  return { role: "assistant", content };
}

function toolCallPart(toolName: string, input: unknown) {
  return { type: "tool-call" as const, toolCallId: "id-1", toolName, input };
}

function toolResultPart(toolName: string, output: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { type: "tool-result" as const, toolCallId: "id-1", toolName, output: output as any };
}

describe("estimateTokens", () => {
  it("returns 0 for an empty message list", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("estimates tokens for a simple string message", () => {
    // "hello" = 5 chars / 4 chars-per-token = ceil(5/4) = 2 tokens total? No:
    // Each message's chars are summed, then divided once at the end.
    // Actually: estimateTokens sums chars across messages, then Math.ceil(total/4)
    // "hello" = 5 chars → ceil(5/4) = 2
    const messages: ModelMessage[] = [userMsg("hello")];
    expect(estimateTokens(messages)).toBe(Math.ceil("hello".length / 4));
  });

  it("sums across multiple messages", () => {
    const messages: ModelMessage[] = [
      userMsg("hello"),       // 5 chars → ceil(5/4) = 2 tokens
      assistantMsg("world"),  // 5 chars → ceil(5/4) = 2 tokens
    ];
    // Per-message rounding: 2 + 2 = 4. (We round per message rather than
    // summing chars first so a turn full of short tool-result snippets
    // doesn't get artificially under-counted by accumulated rounding.)
    expect(estimateTokens(messages)).toBe(
      Math.ceil(5 / 4) + Math.ceil(5 / 4),
    );
  });

  it("handles assistant messages with string content", () => {
    const msg: ModelMessage = assistantMsg("A ".repeat(200)); // 400 chars
    expect(estimateTokens([msg])).toBe(Math.ceil(400 / 4));
  });

  it("counts tool-call parts by their JSON-stringified input", () => {
    const input = { location: "Tokyo" };
    const msg: ModelMessage = {
      role: "assistant",
      content: [toolCallPart("getWeather", input)],
    };
    const expectedChars = JSON.stringify(input).length;
    expect(estimateTokens([msg])).toBe(Math.ceil(expectedChars / 4));
  });

  it("counts tool-result parts with string output by the string length", () => {
    const output = "72°F and sunny";
    const msg: ModelMessage = {
      role: "tool",
      content: [toolResultPart("getWeather", output)],
    };
    // String output → counted as output.length
    expect(estimateTokens([msg])).toBe(Math.ceil(output.length / 4));
  });

  it("counts tool-result parts with object output by JSON stringify length", () => {
    const output = { temp: 72, unit: "F" };
    const msg: ModelMessage = {
      role: "tool",
      content: [toolResultPart("getWeather", output)],
    };
    const expectedChars = JSON.stringify(output).length;
    expect(estimateTokens([msg])).toBe(Math.ceil(expectedChars / 4));
  });

  it("handles a message with mixed text + tool-call parts", () => {
    const textPart = { type: "text" as const, text: "I'll check the weather." };
    const callPart = toolCallPart("getWeather", { city: "London" });
    const msg: ModelMessage = {
      role: "assistant",
      content: [textPart, callPart],
    };
    // Per-part rounding: each part rounds up independently. Summing chars
    // first would under-count by the rounding lost on each individual part.
    const expected =
      Math.ceil("I'll check the weather.".length / 4) +
      Math.ceil(JSON.stringify({ city: "London" }).length / 4);
    expect(estimateTokens([msg])).toBe(expected);
  });

  it("returns at least 1 for a non-empty message", () => {
    // Even a single character should produce at least 1 token estimate
    expect(estimateTokens([userMsg("x")])).toBeGreaterThanOrEqual(1);
  });

  it("scales linearly with content length", () => {
    const short = estimateTokens([userMsg("a".repeat(100))]);
    const long = estimateTokens([userMsg("a".repeat(400))]);
    // 100 chars → ceil(100/4) = 25; 400 chars → ceil(400/4) = 100; ratio = 4
    expect(long / short).toBeCloseTo(4, 1);
  });

  it("ignores unknown part types gracefully (returns 0 chars for them)", () => {
    const msg: ModelMessage = {
      role: "assistant",
      // @ts-expect-error — simulating an unknown part type
      content: [{ type: "totally-made-up", data: "x" }],
    };
    // Unknown part: no `text`, not tool-call/result, not file/image → 0 tokens
    expect(estimateTokens([msg])).toBe(0);
  });

  it("charges a flat per-image allowance for file/image parts", () => {
    // The provider's image tokenization (~1.5k for a typical screenshot) has
    // no relationship to the base64 character length, so we charge a flat
    // allowance per file/image part. This matters for image-heavy chats
    // where char-counting the base64 either wildly over- or under-estimates.
    const fileMsg: ModelMessage = {
      role: "user",
      content: [{ type: "file", data: "x", mediaType: "image/png" }],
    };
    const imageMsg: ModelMessage = {
      role: "user",
      content: [{ type: "image", image: "x" }],
    };
    expect(estimateTokens([fileMsg])).toBeGreaterThanOrEqual(1000);
    expect(estimateTokens([imageMsg])).toBeGreaterThanOrEqual(1000);
  });

  it("uses Math.ceil so partial chars round up to at least 1 token", () => {
    // 1 char / 4 = 0.25 → ceil to 1
    expect(estimateTokens([userMsg("a")])).toBe(1);
    // 4 chars / 4 = 1.0 → ceil to 1
    expect(estimateTokens([userMsg("abcd")])).toBe(1);
    // 5 chars / 4 = 1.25 → ceil to 2
    expect(estimateTokens([userMsg("abcde")])).toBe(2);
  });

  it("counts tool-result with multimodal `content` output by walking parts (not the base64)", () => {
    // Regression: `screenshotDesign` returns
    //   { type: "content", value: [<text>, { type: "image-data", data: <base64> }] }
    // via `toModelOutput`. JSON-stringifying that whole output would count
    // the base64 string as text — easily 25k+ "tokens" per screenshot — and
    // cause the rolling-summary trigger to fire on every turn that has even
    // a stale screenshot in tool-result history. We must walk the content
    // parts and apply the per-image flat allowance instead.
    const text = "Live render of the design.";
    // Simulate a typical screenshot: ~150 KB base64 string.
    const base64 = "A".repeat(150_000);
    const msg: ModelMessage = {
      role: "tool",
      content: [
        {
          type: "tool-result" as const,
          toolCallId: "id-shot",
          toolName: "screenshotDesign",
          output: {
            type: "content",
            value: [
              { type: "text", text },
              {
                type: "image-data",
                data: base64,
                mediaType: "image/png",
              },
            ],
          },
        },
      ],
    };
    // Expected: text portion counted normally + ONE flat image allowance.
    // Naive JSON.stringify would charge ~150_000 / 4 ≈ 37_500 tokens.
    const expected = Math.ceil(text.length / 4) + 1500;
    const actual = estimateTokens([msg]);
    expect(actual).toBe(expected);
    // Belt-and-braces: the buggy path would massively over-count.
    expect(actual).toBeLessThan(5_000);
  });

  it("falls back to JSON-stringify length for non-multimodal tool-result outputs", () => {
    // `{ type: "json", value: ... }` and unknown shapes still get the safe
    // upper-bound treatment — only the multimodal `content` shape is special.
    const value = { temp: 72, conditions: "sunny" };
    const msg: ModelMessage = {
      role: "tool",
      content: [
        {
          type: "tool-result" as const,
          toolCallId: "id-w",
          toolName: "getWeather",
          output: { type: "json", value },
        },
      ],
    };
    const expectedChars = JSON.stringify({ type: "json", value }).length;
    expect(estimateTokens([msg])).toBe(Math.ceil(expectedChars / 4));
  });

  it("handles a large realistic conversation without throwing", () => {
    const messages: ModelMessage[] = Array.from({ length: 50 }, (_, i) =>
      i % 2 === 0
        ? userMsg("Can you update the header component? " + "detail ".repeat(20))
        : assistantMsg("Sure, I'll update the header. " + "code ".repeat(100)),
    );
    expect(() => estimateTokens(messages)).not.toThrow();
    expect(estimateTokens(messages)).toBeGreaterThan(0);
  });
});
