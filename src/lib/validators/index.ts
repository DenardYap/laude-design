import { z } from "zod";

export const ProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Max 80 characters"),
});
export type ProjectInput = z.infer<typeof ProjectSchema>;

export const AiProviderEnum = z.enum(["CLAUDE", "GEMINI", "OPENAI"]);
export type AiProvider = z.infer<typeof AiProviderEnum>;

export const ApiKeySchema = z.object({
  provider: AiProviderEnum,
  secret: z
    .string()
    .min(8, "Key looks too short")
    .max(512, "Key looks too long")
    .refine((v) => !/\s/.test(v), "API key cannot contain whitespace"),
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
