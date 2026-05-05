import { describe, expect, it } from "vitest";
import { lastFour } from "./last-four";

describe("lastFour", () => {
  it("returns the last four characters of a long string", () => {
    expect(lastFour("sk-abcdefghij1234")).toBe("1234");
  });

  it("returns the value unchanged when exactly 4 characters", () => {
    expect(lastFour("abcd")).toBe("abcd");
  });

  it("pads shorter strings with bullet characters", () => {
    expect(lastFour("ab")).toBe("••ab");
    expect(lastFour("a")).toBe("•••a");
    expect(lastFour("")).toBe("••••");
  });

  it("handles a 5-character string", () => {
    expect(lastFour("hello")).toBe("ello");
  });

  it("uses the real last four of a plausible key", () => {
    const key = "sk-ant-api03-abc123_XYZ9abc";
    expect(lastFour(key)).toBe("9abc");
  });
});
