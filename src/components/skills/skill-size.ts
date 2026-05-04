import { estimateTokens } from "@/lib/utils";

/**
 * Coarse token buckets used by the Tokens filter on both Skills tabs. We
 * estimate tokens from char count using the 4-chars-per-token heuristic so
 * labels stay meaningful regardless of whether the underlying file is
 * markdown or plain text. (Real tokenization varies by model; this is a
 * surface-level UI hint, not an authoritative count.)
 */
export type SkillSizeBucket = "small" | "medium" | "large";

export const SKILL_SIZE_OPTIONS: Array<{ value: SkillSizeBucket; label: string }> = [
  { value: "small", label: "Small (<1k tokens)" },
  { value: "medium", label: "Medium (1k–5k)" },
  { value: "large", label: "Large (>5k)" },
];

/** Bucket a skill into a coarse token range from its raw character count. */
export function bucketBySize(charCount: number): SkillSizeBucket {
  const tokens = estimateTokens(charCount);
  if (tokens < 1_000) return "small";
  if (tokens < 5_000) return "medium";
  return "large";
}

/**
 * Format a char count as a compact, scannable *token estimate* string for
 * tight row layouts. Examples: 800 chars → "200" (tokens), 4_800 chars →
 * "1.2k", 100_000 chars → "25k". The returned value is unitless because the
 * column header carries the unit ("Tokens").
 */
export function formatTokens(charCount: number): string {
  const tokens = estimateTokens(charCount);
  if (tokens < 1_000) return `${tokens}`;
  return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}k`;
}
