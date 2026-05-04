import type { FilterGroup } from "@/components/shared/multi-dimension-filter";
import { SKILL_SIZE_OPTIONS } from "@/components/skills/utils/skill-size";

export const SIZE_GROUP: FilterGroup = {
  dimension: "size",
  label: "Tokens",
  options: SKILL_SIZE_OPTIONS,
};

export const VISIBILITY_GROUP: FilterGroup = {
  dimension: "visibility",
  label: "Visibility",
  options: [
    { value: "public", label: "Public" },
    { value: "private", label: "Private" },
  ],
};

export const DEFAULT_GROUP: FilterGroup = {
  dimension: "default",
  label: "Default applied",
  options: [
    { value: "on", label: "Applied to all projects" },
    { value: "off", label: "Not applied" },
  ],
};

export const AUTHOR_GROUP: FilterGroup = {
  dimension: "author",
  label: "Author",
  options: [
    { value: "me", label: "Me" },
    { value: "others", label: "Others" },
  ],
};

/** True when the user has any non-default filter state in this scope. */
export function hasActiveFilters(query: string, dimensionValues: string[][]): boolean {
  return query.trim().length > 0 || dimensionValues.some((arr) => arr.length > 0);
}
