import { estimateTokens } from "@/lib/utils";
import type { SkillSizeBucket } from "@/components/skills/types/skills";

export const SKILL_SIZE_OPTIONS: Array<{ value: SkillSizeBucket; label: string }> = [
  { value: "small", label: "Small (<1k tokens)" },
  { value: "medium", label: "Medium (1k–5k)" },
  { value: "large", label: "Large (>5k)" },
];

export function bucketBySize(charCount: number): SkillSizeBucket {
  const tokens = estimateTokens(charCount);
  if (tokens < 1_000) return "small";
  if (tokens < 5_000) return "medium";
  return "large";
}

export function formatTokens(charCount: number): string {
  const tokens = estimateTokens(charCount);
  if (tokens < 1_000) return `${tokens}`;
  return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}k`;
}
