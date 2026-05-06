import type { MineSkill, PublicSkill } from "@/components/skills/types/skills";

import type {
  PagedResult,
  MineSkillsParams,
  PublicSkillsParams,
} from "./types/skills";

export type { PagedResult, MineSkillsParams, PublicSkillsParams };

function buildSearchParams(
  entries: Record<string, string | string[] | number>,
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(entries)) {
    if (Array.isArray(val)) {
      if (val.length > 0) sp.set(key, val.join(","));
    } else if (val !== "") {
      sp.set(key, String(val));
    }
  }
  return sp;
}

export const skillKeys = {
  mine: (params: MineSkillsParams) => ["skills", "mine", params] as const,
  public: (params: PublicSkillsParams) => ["skills", "public", params] as const,
};

export async function fetchMySkills(
  params: MineSkillsParams,
): Promise<PagedResult<MineSkill>> {
  const sp = buildSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    visibility: params.visibility,
    size: params.size,
    default: params.default,
    author: params.author,
  });
  const res = await fetch(`/api/skills/mine?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch skills");
  return res.json();
}

export async function fetchPublicSkills(
  params: PublicSkillsParams,
): Promise<PagedResult<PublicSkill>> {
  const sp = buildSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    size: params.size,
    author: params.author,
    sort: params.sort,
  });
  const res = await fetch(`/api/skills/public?${sp}`);
  if (!res.ok) throw new Error("Failed to fetch skills");
  return res.json();
}
