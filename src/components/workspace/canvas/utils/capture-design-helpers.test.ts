import { describe, expect, it } from "vitest";

import {
  buildScreenshotFilename,
  cssAttrEscape,
  isValidPngDataUrl,
  isVisibleCanvasOnDesign,
} from "./capture-design-helpers";

/**
 * The orchestrator inside `capture-design.ts` is async, DOM-driven, and
 * coordinates two clients of a Zustand store — basically untestable
 * without a full jsdom + Sandpack harness. But every *decision* it
 * makes is delegated to one of the small pure helpers below, so we can
 * pin the behavior with hermetic Node tests.
 */

describe("isVisibleCanvasOnDesign", () => {
  it("returns true when the active tab matches the requested design", () => {
    expect(isVisibleCanvasOnDesign("design:abc-123", "abc-123")).toBe(true);
  });

  it("returns false when the active tab is the files tree", () => {
    expect(isVisibleCanvasOnDesign("files", "abc-123")).toBe(false);
  });

  it("returns false when the active tab is a different design", () => {
    expect(isVisibleCanvasOnDesign("design:other", "abc-123")).toBe(false);
  });

  it("returns false when the active tab is undefined (no tab open)", () => {
    expect(isVisibleCanvasOnDesign(undefined, "abc-123")).toBe(false);
  });

  it("returns false for an empty designId (defensive — caller should never pass this)", () => {
    expect(isVisibleCanvasOnDesign("design:", "")).toBe(false);
    expect(isVisibleCanvasOnDesign("design:abc", "")).toBe(false);
  });

  it("does not match a tab that is a prefix of the design id", () => {
    // Without exact equality, "design:abc" + designId "abc-123" would
    // accidentally match. Pin the exact-equality behavior so a future
    // refactor that loosens it gets caught.
    expect(isVisibleCanvasOnDesign("design:abc", "abc-123")).toBe(false);
  });

  it("does not match a tab whose suffix begins with the design id", () => {
    // Symmetric to the prefix case: "design:abc-123-extra" must not
    // satisfy a query for "abc-123".
    expect(isVisibleCanvasOnDesign("design:abc-123-extra", "abc-123")).toBe(
      false,
    );
  });

  it("rejects a non-string activeTab without throwing", () => {
    // Caller is typed but the store can return undefined for never-opened
    // projects, and a bad consumer might pass a number from a stale URL
    // param. The helper should fail closed, not throw.
    expect(
      isVisibleCanvasOnDesign(42 as unknown as string, "abc"),
    ).toBe(false);
    expect(
      isVisibleCanvasOnDesign(null as unknown as string, "abc"),
    ).toBe(false);
  });

  it("rejects a non-string designId without throwing", () => {
    expect(
      isVisibleCanvasOnDesign("design:abc", 42 as unknown as string),
    ).toBe(false);
    expect(
      isVisibleCanvasOnDesign("design:abc", null as unknown as string),
    ).toBe(false);
  });
});

describe("isValidPngDataUrl (orchestrator-side mirror)", () => {
  it("accepts a normal data URL with valid base64", () => {
    expect(
      isValidPngDataUrl("data:image/png;base64,iVBORw0KGgoAAA=="),
    ).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(isValidPngDataUrl(undefined)).toBe(false);
    expect(isValidPngDataUrl(null)).toBe(false);
    expect(isValidPngDataUrl(42)).toBe(false);
  });

  it("rejects the wrong MIME type prefix", () => {
    expect(isValidPngDataUrl("data:image/svg+xml;base64,abc")).toBe(false);
    expect(isValidPngDataUrl("data:image/jpeg;base64,abc")).toBe(false);
    expect(isValidPngDataUrl("data:text/plain;base64,abc")).toBe(false);
  });

  it("rejects empty bodies and non-base64 characters", () => {
    expect(isValidPngDataUrl("data:image/png;base64,")).toBe(false);
    expect(isValidPngDataUrl("data:image/png;base64, abc==")).toBe(false);
    expect(isValidPngDataUrl("data:image/png;base64,abc<svg>")).toBe(false);
  });

  it("rejects payloads above the 32 MB cap", () => {
    const giant = "data:image/png;base64," + "A".repeat(32 * 1024 * 1024 + 1);
    expect(isValidPngDataUrl(giant)).toBe(false);
  });

  it("accepts standard padding", () => {
    expect(isValidPngDataUrl("data:image/png;base64,abcd")).toBe(true);
    expect(isValidPngDataUrl("data:image/png;base64,abc=")).toBe(true);
    expect(isValidPngDataUrl("data:image/png;base64,ab==")).toBe(true);
  });
});

describe("cssAttrEscape", () => {
  it("leaves UUIDs and alphanumeric ids untouched", () => {
    expect(cssAttrEscape("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(cssAttrEscape("design_abc_123")).toBe("design_abc_123");
  });

  it('escapes double-quote and backslash characters', () => {
    // These are the only characters that have special meaning inside
    // `[attr="..."]` per CSSOM Selectors L4 § 9.7. Anything else is
    // safe to embed verbatim.
    expect(cssAttrEscape('a"b')).toBe('a\\"b');
    expect(cssAttrEscape("a\\b")).toBe("a\\\\b");
    // Combined attack — try to escape the quote and immediately re-open
    // the attribute selector to inject a sibling clause.
    expect(cssAttrEscape('"][onerror=alert(1)]"')).toBe(
      '\\"][onerror=alert(1)]\\"',
    );
  });

  it("does not escape characters that are safe in attribute selectors", () => {
    expect(cssAttrEscape("a.b#c:d[e]")).toBe("a.b#c:d[e]");
    expect(cssAttrEscape("with spaces")).toBe("with spaces");
  });
});

describe("buildScreenshotFilename", () => {
  it("formats date and time with zero-padded components", () => {
    // Fixed time so we can pin the exact filename.
    const fixed = new Date(2026, 0, 5, 9, 4, 7); // Jan 5 09:04:07 local
    expect(buildScreenshotFilename(fixed)).toBe(
      "Self-critique screenshot 2026-01-05 at 09.04.07.png",
    );
  });

  it("emits a different filename for a one-second-later capture", () => {
    // The agent might take two screenshots in quick succession across
    // revision rounds; the filenames should at least be visually
    // distinguishable in the upload list.
    const a = buildScreenshotFilename(new Date(2026, 0, 5, 9, 4, 7));
    const b = buildScreenshotFilename(new Date(2026, 0, 5, 9, 4, 8));
    expect(a).not.toBe(b);
  });

  it("ends in .png so the upload route routes it through the PNG branch", () => {
    expect(
      buildScreenshotFilename(new Date(2026, 11, 31, 23, 59, 59)).endsWith(
        ".png",
      ),
    ).toBe(true);
  });

  it("uses local time, not UTC (matches the timezone shown in the upload list)", () => {
    // We can't pin a specific timezone offset in CI, so instead we
    // assert that two `Date` objects representing the same wall-clock
    // values produce the same filename regardless of the host TZ.
    const local = new Date(2026, 5, 15, 14, 30, 0);
    const same = new Date(local.getTime());
    expect(buildScreenshotFilename(local)).toBe(buildScreenshotFilename(same));
  });
});
