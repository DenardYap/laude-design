import { beforeAll, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

const TEST_KEY_BASE64 = Buffer.alloc(32).toString("base64");

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY_BASE64;
});

describe("encryptSecret", () => {
  it("returns a colon-delimited string with three base64 segments", () => {
    const result = encryptSecret("hello");
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
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
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    try {
      expect(() => encryptSecret("test")).toThrow(/32 bytes/);
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });
});

describe("decryptSecret", () => {
  it("round-trips correctly", () => {
    const plaintext = "sk-abc123secretkey";
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  it("round-trips unicode content", () => {
    const original = "日本語テスト 🎉";
    expect(decryptSecret(encryptSecret(original))).toBe(original);
  });

  it("throws on a payload with fewer than three colon segments", () => {
    expect(() => decryptSecret("onlytwoparts")).toThrow(/Malformed/i);
    expect(() => decryptSecret("part1:part2")).toThrow(/Malformed/i);
  });

  it("throws on a tampered auth tag (integrity violation)", () => {
    const encrypted = encryptSecret("sensitive");
    const [iv, tag, ct] = encrypted.split(":");
    const badTag = Buffer.from(tag!, "base64");
    badTag[0] ^= 0xff;
    const tampered = `${iv}:${badTag.toString("base64")}:${ct}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
