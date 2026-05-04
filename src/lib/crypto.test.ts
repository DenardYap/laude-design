import { beforeAll, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, lastFour } from "./crypto";

// Valid 32-byte key encoded in base64 (32 × 'A' = AAAA...= in base64)
const TEST_KEY_BASE64 = Buffer.alloc(32).toString("base64");

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY_BASE64;
});

describe("encryptSecret", () => {
  it("returns a colon-delimited string with three base64 segments", () => {
    const result = encryptSecret("hello");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    // Each segment must be non-empty and valid base64
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encryptSecret("same-plaintext");
    const b = encryptSecret("same-plaintext");
    expect(a).not.toBe(b);
  });

  it("encrypts an empty string without throwing", () => {
    expect(() => encryptSecret("")).not.toThrow();
  });

  it("encrypts a long string", () => {
    const long = "x".repeat(10_000);
    const result = encryptSecret(long);
    expect(result.split(":")).toHaveLength(3);
  });

  it("encrypts unicode characters", () => {
    const result = encryptSecret("日本語テスト 🎉");
    expect(result.split(":")).toHaveLength(3);
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encryptSecret("test")).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it("throws when ENCRYPTION_KEY is not 32 bytes", () => {
    const original = process.env.ENCRYPTION_KEY;
    // 16 bytes base64-encoded
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    try {
      expect(() => encryptSecret("test")).toThrow(/32 bytes/);
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });
});

describe("decryptSecret", () => {
  it("round-trips correctly (encrypt → decrypt = original plaintext)", () => {
    const plaintext = "sk-abc123secretkey";
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const encrypted = encryptSecret("");
    expect(decryptSecret(encrypted)).toBe("");
  });

  it("round-trips unicode content", () => {
    const original = "日本語テスト 🎉";
    const encrypted = encryptSecret(original);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("round-trips a long secret", () => {
    const long = "x".repeat(10_000);
    expect(decryptSecret(encryptSecret(long))).toBe(long);
  });

  it("throws on a payload with fewer than three colon segments", () => {
    expect(() => decryptSecret("onlytwoparts")).toThrow(/Malformed/i);
    expect(() => decryptSecret("part1:part2")).toThrow(/Malformed/i);
  });

  it("throws on a tampered auth tag (integrity violation)", () => {
    const encrypted = encryptSecret("sensitive");
    const [iv, , ct] = encrypted.split(":");
    // Flip the first byte of the tag → GCM will reject it
    const badTag = Buffer.from(iv!, "base64");
    badTag[0] ^= 0xff;
    const tampered = `${iv}:${badTag.toString("base64")}:${ct}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when ENCRYPTION_KEY is missing during decrypt", () => {
    const encrypted = encryptSecret("test");
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => decryptSecret(encrypted)).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });
});

describe("lastFour", () => {
  it("returns the last 4 characters for a long string", () => {
    expect(lastFour("sk-abcdefghij1234")).toBe("1234");
  });

  it("returns the last 4 characters of an exactly 4-char string", () => {
    expect(lastFour("abcd")).toBe("abcd");
  });

  it("pads with bullet characters when the string is shorter than 4 chars", () => {
    expect(lastFour("ab")).toBe("••ab");
    expect(lastFour("a")).toBe("•••a");
    expect(lastFour("")).toBe("••••");
  });

  it("handles a string of exactly 5 characters", () => {
    expect(lastFour("hello")).toBe("ello");
  });

  it("works on API key-shaped strings", () => {
    // Real-world format: last 4 chars should be the last 4 of the original
    const key = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx9abc";
    expect(lastFour(key)).toBe("9abc");
  });
});
