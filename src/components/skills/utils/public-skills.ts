import { match } from "ts-pattern";
import type { SortOption } from "@/components/shared/sort-menu";
import type { PublicSkill } from "@/components/skills/types/skills";
import type { PublicSortKey } from "@/components/skills/types/skill-table";

export const SORT_OPTIONS: ReadonlyArray<SortOption<PublicSortKey>> = [
  { value: "saves", label: "Most saved" },
  { value: "likes", label: "Most liked" },
  { value: "updated", label: "Recently updated" },
];

export function sortPublicSkills(skills: PublicSkill[], key: PublicSortKey): PublicSkill[] {
  const ts = (s: PublicSkill) => new Date(s.updatedAt).getTime();
  return [...skills].sort((a, b) => {
    const primary = match(key)
      .with("saves", () => b.saves - a.saves)
      .with("likes", () => b.likes - a.likes)
      .with("updated", () => ts(b) - ts(a))
      .exhaustive();
    return primary !== 0 ? primary : ts(b) - ts(a);
  });
}
