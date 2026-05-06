import { z } from "zod";

export const ProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Max 80 characters"),
});
export type ProjectInput = z.infer<typeof ProjectSchema>;

export const AiProviderEnum = z.enum(["CLAUDE", "GEMINI", "OPENAI"]);
export type AiProvider = z.infer<typeof AiProviderEnum>;

// Auto-expiry presets surfaced in the UI. "never" (the default) means the
// key persists until the user explicitly deletes it; the day-based options
// store an explicit `expiresAt` and are lazy-deleted by the chat route once
// they pass.
export const ApiKeyLifetimeEnum = z.enum(["never", "7d", "14d", "30d"]);
export type ApiKeyLifetime = z.infer<typeof ApiKeyLifetimeEnum>;

const DAY_MS = 24 * 60 * 60 * 1000;
export { DAY_MS };
const LIFETIME_DAYS: Record<Exclude<ApiKeyLifetime, "never">, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

/**
 * Returns the absolute expiry timestamp for a chosen lifetime, or null when
 * the user picked "never". Callers MUST treat null as "no auto-expiry"
 * rather than substituting their own default.
 */
export function expiryFromLifetime(
  lifetime: ApiKeyLifetime,
  now: Date = new Date(),
): Date | null {
  if (lifetime === "never") return null;
  return new Date(now.getTime() + LIFETIME_DAYS[lifetime] * DAY_MS);
}

export const ApiKeySchema = z.object({
  provider: AiProviderEnum,
  secret: z
    .string()
    .min(8, "Key looks too short")
    .max(512, "Key looks too long")
    .refine((v) => !/\s/.test(v), "API key cannot contain whitespace"),
  lifetime: ApiKeyLifetimeEnum.default("never"),
});
export type ApiKeyInput = z.infer<typeof ApiKeySchema>;

export const SkillSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(280).optional().nullable(),
  content: z
    .string()
    .min(1, "Skill content is required")
    .max(64 * 1024, "Skill content must be <= 64 KB"),
  isPublic: z.boolean().default(false),
});
export type SkillInput = z.infer<typeof SkillSchema>;

export const SkillUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(280).nullable().optional(),
  content: z
    .string()
    .min(1, "Skill content is required")
    .max(64 * 1024, "Skill content must be <= 64 KB"),
});
export type SkillUpdateInput = z.infer<typeof SkillUpdateSchema>;
