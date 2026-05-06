import type { PublicSortKey } from "@/components/skills/types/skill-table";

export interface PagedResult<T> {
  skills: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MineSkillsParams {
  page: number;
  pageSize: number;
  q: string;
  visibility: string[];
  size: string[];
  default: string[];
  author: string[];
}

export interface PublicSkillsParams {
  page: number;
  pageSize: number;
  q: string;
  size: string[];
  author: string[];
  sort: PublicSortKey;
}
