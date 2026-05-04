import { describe, expect, it } from "vitest";

import {
  TAG_MARKER_PREFIX,
  buildTagMarker,
  isTagMarker,
  parseTagMarker,
} from "./tag-markers";

describe("buildTagMarker", () => {
  it("produces a string starting with the marker prefix", () => {
    const marker = buildTagMarker({ selector: "div.container", text: "Hello" });
    expect(marker.startsWith(TAG_MARKER_PREFIX)).toBe(true);
  });

  it("embeds the selector in the output", () => {
    const marker = buildTagMarker({ selector: "#main > h1", text: "Title" });
    expect(marker).toContain("#main > h1");
  });

  it("embeds the text in the output", () => {
    const marker = buildTagMarker({ selector: "p", text: "Some paragraph text" });
    expect(marker).toContain("Some paragraph text");
  });

  it("produces valid JSON after the prefix", () => {
    const marker = buildTagMarker({ selector: "div", text: "test" });
    const json = marker.slice(TAG_MARKER_PREFIX.length);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("handles selectors with special CSS characters", () => {
    const selector = `div > span:nth-child(2)[data-id="foo"]`;
    const marker = buildTagMarker({ selector, text: "content" });
    const parsed = parseTagMarker(marker);
    expect(parsed?.selector).toBe(selector);
  });

  it("handles text with quotes and backslashes", () => {
    const text = `He said "hello" and she said \\goodbye\\`;
    const marker = buildTagMarker({ selector: "p", text });
    const parsed = parseTagMarker(marker);
    expect(parsed?.text).toBe(text);
  });

  it("handles text with newlines and unicode", () => {
    const text = "Line one\nLine two\n日本語";
    const marker = buildTagMarker({ selector: "pre", text });
    const parsed = parseTagMarker(marker);
    expect(parsed?.text).toBe(text);
  });

  it("is round-trippable through parseTagMarker", () => {
    const tag = { selector: "main > article > p:first-child", text: "Intro paragraph" };
    expect(parseTagMarker(buildTagMarker(tag))).toEqual(tag);
  });
});

describe("parseTagMarker", () => {
  it("returns null for a string that doesn't start with the prefix", () => {
    expect(parseTagMarker("not a tag marker")).toBeNull();
    expect(parseTagMarker("")).toBeNull();
  });

  it("returns null for just the prefix with no JSON", () => {
    expect(parseTagMarker(TAG_MARKER_PREFIX)).toBeNull();
  });

  it("returns null for the prefix followed by invalid JSON", () => {
    expect(parseTagMarker(`${TAG_MARKER_PREFIX}{not valid json`)).toBeNull();
  });

  it("returns null when the parsed JSON is missing the selector field", () => {
    const json = JSON.stringify({ text: "some text" });
    expect(parseTagMarker(`${TAG_MARKER_PREFIX}${json}`)).toBeNull();
  });

  it("returns null when selector is not a string", () => {
    const json = JSON.stringify({ selector: 42, text: "text" });
    expect(parseTagMarker(`${TAG_MARKER_PREFIX}${json}`)).toBeNull();
  });

  it("defaults text to empty string when text field is missing", () => {
    const json = JSON.stringify({ selector: "div" });
    const result = parseTagMarker(`${TAG_MARKER_PREFIX}${json}`);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("");
  });

  it("defaults text to empty string when text field is not a string", () => {
    const json = JSON.stringify({ selector: "div", text: 123 });
    const result = parseTagMarker(`${TAG_MARKER_PREFIX}${json}`);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("");
  });

  it("parses a valid marker with both fields", () => {
    const json = JSON.stringify({ selector: "button.primary", text: "Submit" });
    const result = parseTagMarker(`${TAG_MARKER_PREFIX}${json}`);
    expect(result).toEqual({ selector: "button.primary", text: "Submit" });
  });

  it("handles leading whitespace after the prefix", () => {
    // The implementation trims the JSON before parsing
    const json = JSON.stringify({ selector: "div", text: "content" });
    const result = parseTagMarker(`${TAG_MARKER_PREFIX}   ${json}`);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe("div");
  });
});

describe("isTagMarker", () => {
  it("returns true for a string built by buildTagMarker", () => {
    const marker = buildTagMarker({ selector: "div", text: "test" });
    expect(isTagMarker(marker)).toBe(true);
  });

  it("returns true for any string starting with the prefix", () => {
    expect(isTagMarker(`${TAG_MARKER_PREFIX}anything`)).toBe(true);
  });

  it("returns false for a plain string", () => {
    expect(isTagMarker("hello world")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isTagMarker("")).toBe(false);
  });

  it("returns false for a string that almost matches the prefix", () => {
    // Off by one character
    const almostPrefix = TAG_MARKER_PREFIX.slice(0, -1);
    expect(isTagMarker(`${almostPrefix}json`)).toBe(false);
  });

  it("is consistent with parseTagMarker's prefix check", () => {
    // Any string where isTagMarker returns true may or may not parse
    // successfully (invalid JSON after prefix), but any string where it
    // returns false must return null from parseTagMarker.
    const strings = [
      buildTagMarker({ selector: "div", text: "a" }),
      "regular text",
      "",
      TAG_MARKER_PREFIX,
      `${TAG_MARKER_PREFIX}{}`,
    ];
    for (const s of strings) {
      if (!isTagMarker(s)) {
        expect(parseTagMarker(s), `parseTagMarker("${s}") should be null`).toBeNull();
      }
    }
  });
});

describe("TAG_MARKER_PREFIX constant", () => {
  it("is non-empty", () => {
    expect(TAG_MARKER_PREFIX.length).toBeGreaterThan(0);
  });

  it("contains 'laude:tag' as the identifying namespace", () => {
    expect(TAG_MARKER_PREFIX).toContain("laude:tag");
  });
});
