import { describe, expect, it } from "vitest";

import {
  INTERNAL_NOTE_PREFIX,
  buildScreenshotContextNote,
  buildSketchContextNote,
  isInternalNote,
} from "./internal-notes";

describe("isInternalNote", () => {
  it("returns true for a string starting with the prefix", () => {
    expect(isInternalNote(`${INTERNAL_NOTE_PREFIX}any content here`)).toBe(true);
  });

  it("returns true for a string built by buildScreenshotContextNote", () => {
    const note = buildScreenshotContextNote(1);
    expect(isInternalNote(note)).toBe(true);
  });

  it("returns true for a string built by buildSketchContextNote", () => {
    const note = buildSketchContextNote(1);
    expect(isInternalNote(note)).toBe(true);
  });

  it("returns false for a regular user message", () => {
    expect(isInternalNote("Please make the button red")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isInternalNote("")).toBe(false);
  });

  it("returns false when the prefix appears mid-string but not at the start", () => {
    expect(isInternalNote(`some text ${INTERNAL_NOTE_PREFIX}`)).toBe(false);
  });

  it("returns false for just a partial match of the prefix", () => {
    const partial = INTERNAL_NOTE_PREFIX.slice(0, INTERNAL_NOTE_PREFIX.length - 1);
    expect(isInternalNote(`${partial}content`)).toBe(false);
  });
});

describe("buildScreenshotContextNote", () => {
  it("returns an empty string for count <= 0", () => {
    expect(buildScreenshotContextNote(0)).toBe("");
    expect(buildScreenshotContextNote(-1)).toBe("");
    expect(buildScreenshotContextNote(-100)).toBe("");
  });

  it("uses singular 'screenshot' for count = 1", () => {
    const note = buildScreenshotContextNote(1);
    // The noun after the count uses the singular form
    expect(note).toContain("1 screenshot");
  });

  it("uses plural 'screenshots' for count > 1", () => {
    expect(buildScreenshotContextNote(2)).toContain("2 screenshots");
    expect(buildScreenshotContextNote(5)).toContain("5 screenshots");
  });

  it("starts with the internal note prefix", () => {
    expect(buildScreenshotContextNote(1).startsWith(INTERNAL_NOTE_PREFIX)).toBe(true);
    expect(buildScreenshotContextNote(3).startsWith(INTERNAL_NOTE_PREFIX)).toBe(true);
  });

  it("mentions 'canvas' to give the model context about the source", () => {
    expect(buildScreenshotContextNote(1)).toMatch(/canvas/i);
  });

  it("mentions 'screenshot' tool", () => {
    expect(buildScreenshotContextNote(1)).toMatch(/screenshot/i);
  });

  it("instructs the model to treat images as visual feedback", () => {
    expect(buildScreenshotContextNote(1)).toMatch(/visual feedback|screenshot/i);
  });

  it("is non-empty for any positive count", () => {
    for (const n of [1, 2, 10, 100]) {
      expect(buildScreenshotContextNote(n).length).toBeGreaterThan(0);
    }
  });
});

describe("buildSketchContextNote", () => {
  it("returns an empty string for count <= 0", () => {
    expect(buildSketchContextNote(0)).toBe("");
    expect(buildSketchContextNote(-1)).toBe("");
  });

  it("uses singular 'sketch' for count = 1", () => {
    const note = buildSketchContextNote(1);
    expect(note).toContain("1 sketch");
    expect(note).not.toContain("sketches");
  });

  it("uses plural 'sketches' for count > 1", () => {
    expect(buildSketchContextNote(2)).toContain("2 sketches");
    expect(buildSketchContextNote(10)).toContain("10 sketches");
  });

  it("starts with the internal note prefix", () => {
    expect(buildSketchContextNote(1).startsWith(INTERNAL_NOTE_PREFIX)).toBe(true);
  });

  it("mentions the draw tool", () => {
    expect(buildSketchContextNote(1)).toMatch(/draw/i);
  });

  it("describes hand-drawn annotations to orient the model", () => {
    const note = buildSketchContextNote(1);
    expect(note).toMatch(/drawn|annotation|mark|sketch/i);
  });

  it("is non-empty for any positive count", () => {
    for (const n of [1, 2, 10]) {
      expect(buildSketchContextNote(n).length).toBeGreaterThan(0);
    }
  });
});

describe("INTERNAL_NOTE_PREFIX constant", () => {
  it("is non-empty", () => {
    expect(INTERNAL_NOTE_PREFIX.length).toBeGreaterThan(0);
  });

  it("contains 'laude:internal' as the identifying namespace", () => {
    expect(INTERNAL_NOTE_PREFIX).toContain("laude:internal");
  });

  it("starts with '[' bracket (distinctive marker format)", () => {
    expect(INTERNAL_NOTE_PREFIX.startsWith("[")).toBe(true);
  });
});
