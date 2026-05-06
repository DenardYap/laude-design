import { describe, expect, it } from "vitest";

import {
  AiProviderEnum,
  ApiKeySchema,
  expiryFromLifetime,
  ProjectSchema,
  SkillSchema,
  SkillUpdateSchema,
} from "./index";

describe("ProjectSchema", () => {
  it("accepts a normal project name", () => {
    expect(ProjectSchema.safeParse({ name: "My Project" }).success).toBe(true);
  });

  it("accepts a single-character name", () => {
    expect(ProjectSchema.safeParse({ name: "A" }).success).toBe(true);
  });

  it("accepts exactly 80 characters", () => {
    expect(ProjectSchema.safeParse({ name: "x".repeat(80) }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = ProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/required/i);
    }
  });

  it("rejects a name longer than 80 characters", () => {
    const result = ProjectSchema.safeParse({ name: "x".repeat(81) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/80/);
    }
  });

  it("rejects missing name field", () => {
    expect(ProjectSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a null name", () => {
    expect(ProjectSchema.safeParse({ name: null }).success).toBe(false);
  });
});

describe("AiProviderEnum", () => {
  it("accepts CLAUDE", () => {
    expect(AiProviderEnum.safeParse("CLAUDE").success).toBe(true);
  });

  it("accepts GEMINI", () => {
    expect(AiProviderEnum.safeParse("GEMINI").success).toBe(true);
  });

  it("accepts OPENAI", () => {
    expect(AiProviderEnum.safeParse("OPENAI").success).toBe(true);
  });

  it("rejects lowercase provider names", () => {
    expect(AiProviderEnum.safeParse("claude").success).toBe(false);
    expect(AiProviderEnum.safeParse("openai").success).toBe(false);
    expect(AiProviderEnum.safeParse("gemini").success).toBe(false);
  });

  it("rejects unknown providers", () => {
    expect(AiProviderEnum.safeParse("MISTRAL").success).toBe(false);
    expect(AiProviderEnum.safeParse("").success).toBe(false);
  });
});

describe("ApiKeySchema", () => {
  it("accepts a valid API key with a valid provider", () => {
    expect(
      ApiKeySchema.safeParse({ provider: "OPENAI", secret: "sk-test1234567890" }).success,
    ).toBe(true);
  });

  it("accepts a key at the minimum length (8 chars)", () => {
    expect(
      ApiKeySchema.safeParse({ provider: "CLAUDE", secret: "abcdefgh" }).success,
    ).toBe(true);
  });

  it("accepts a key at the maximum length (512 chars)", () => {
    expect(
      ApiKeySchema.safeParse({ provider: "GEMINI", secret: "x".repeat(512) }).success,
    ).toBe(true);
  });

  it("rejects a key shorter than 8 characters", () => {
    const result = ApiKeySchema.safeParse({ provider: "OPENAI", secret: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/short/i);
    }
  });

  it("rejects a key longer than 512 characters", () => {
    const result = ApiKeySchema.safeParse({ provider: "OPENAI", secret: "x".repeat(513) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/long/i);
    }
  });

  it("rejects a key containing whitespace", () => {
    const result = ApiKeySchema.safeParse({ provider: "OPENAI", secret: "sk-test 12345678" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/whitespace/i);
    }
  });

  it("rejects a key with a tab character", () => {
    expect(
      ApiKeySchema.safeParse({ provider: "OPENAI", secret: "sk-test\t12345" }).success,
    ).toBe(false);
  });

  it("rejects a key with a newline character", () => {
    expect(
      ApiKeySchema.safeParse({ provider: "OPENAI", secret: "sk-test\n12345" }).success,
    ).toBe(false);
  });

  it("rejects an invalid provider", () => {
    expect(
      ApiKeySchema.safeParse({ provider: "UNKNOWN", secret: "validkeyhere" }).success,
    ).toBe(false);
  });

  it("rejects missing secret", () => {
    expect(ApiKeySchema.safeParse({ provider: "OPENAI" }).success).toBe(false);
  });

  it("rejects missing provider", () => {
    expect(ApiKeySchema.safeParse({ secret: "validkeyhere" }).success).toBe(false);
  });

  it("defaults lifetime to 'never' when omitted", () => {
    const result = ApiKeySchema.safeParse({
      provider: "OPENAI",
      secret: "sk-test1234567890",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lifetime).toBe("never");
    }
  });

  it("accepts every supported lifetime value", () => {
    for (const lifetime of ["never", "7d", "14d", "30d"] as const) {
      expect(
        ApiKeySchema.safeParse({
          provider: "OPENAI",
          secret: "sk-test1234567890",
          lifetime,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an unknown lifetime value", () => {
    expect(
      ApiKeySchema.safeParse({
        provider: "OPENAI",
        secret: "sk-test1234567890",
        lifetime: "60d",
      }).success,
    ).toBe(false);
  });
});

describe("expiryFromLifetime", () => {
  const fixedNow = new Date("2026-01-01T00:00:00.000Z");

  it("returns null for the 'never' lifetime", () => {
    expect(expiryFromLifetime("never", fixedNow)).toBeNull();
  });

  it("returns 7 days from now for '7d'", () => {
    const got = expiryFromLifetime("7d", fixedNow);
    expect(got?.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("returns 14 days from now for '14d'", () => {
    const got = expiryFromLifetime("14d", fixedNow);
    expect(got?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("returns 30 days from now for '30d'", () => {
    const got = expiryFromLifetime("30d", fixedNow);
    expect(got?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("SkillSchema", () => {
  const validSkill = {
    name: "My Skill",
    content: "This is some skill content.",
    isPublic: false,
  };

  it("accepts a valid skill", () => {
    expect(SkillSchema.safeParse(validSkill).success).toBe(true);
  });

  it("accepts a skill with optional description", () => {
    expect(
      SkillSchema.safeParse({ ...validSkill, description: "A helpful skill" }).success,
    ).toBe(true);
  });

  it("accepts a skill with null description", () => {
    expect(
      SkillSchema.safeParse({ ...validSkill, description: null }).success,
    ).toBe(true);
  });

  it("defaults isPublic to false when omitted", () => {
    const result = SkillSchema.safeParse({ name: "Skill", content: "Content" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPublic).toBe(false);
    }
  });

  it("rejects empty name", () => {
    expect(SkillSchema.safeParse({ ...validSkill, name: "" }).success).toBe(false);
  });

  it("rejects name longer than 80 characters", () => {
    expect(
      SkillSchema.safeParse({ ...validSkill, name: "x".repeat(81) }).success,
    ).toBe(false);
  });

  it("rejects description longer than 280 characters", () => {
    expect(
      SkillSchema.safeParse({ ...validSkill, description: "x".repeat(281) }).success,
    ).toBe(false);
  });

  it("rejects empty content", () => {
    expect(SkillSchema.safeParse({ ...validSkill, content: "" }).success).toBe(false);
  });

  it("rejects content larger than 64 KB", () => {
    expect(
      SkillSchema.safeParse({ ...validSkill, content: "x".repeat(64 * 1024 + 1) }).success,
    ).toBe(false);
  });

  it("accepts content exactly at the 64 KB limit", () => {
    expect(
      SkillSchema.safeParse({ ...validSkill, content: "x".repeat(64 * 1024) }).success,
    ).toBe(true);
  });
});

describe("SkillUpdateSchema", () => {
  const validUpdate = {
    name: "Updated Skill",
    content: "Updated content here.",
  };

  it("accepts a valid update", () => {
    expect(SkillUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("accepts optional description", () => {
    expect(
      SkillUpdateSchema.safeParse({ ...validUpdate, description: "New desc" }).success,
    ).toBe(true);
  });

  it("accepts null description", () => {
    expect(
      SkillUpdateSchema.safeParse({ ...validUpdate, description: null }).success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(SkillUpdateSchema.safeParse({ ...validUpdate, name: "" }).success).toBe(false);
  });

  it("rejects empty content", () => {
    expect(SkillUpdateSchema.safeParse({ ...validUpdate, content: "" }).success).toBe(false);
  });

  it("rejects content larger than 64 KB", () => {
    expect(
      SkillUpdateSchema.safeParse({ ...validUpdate, content: "x".repeat(64 * 1024 + 1) }).success,
    ).toBe(false);
  });

  it("rejects description longer than 280 characters", () => {
    expect(
      SkillUpdateSchema.safeParse({ ...validUpdate, description: "x".repeat(281) }).success,
    ).toBe(false);
  });
});
