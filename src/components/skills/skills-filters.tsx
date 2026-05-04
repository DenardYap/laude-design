"use client";

import { SearchBar } from "@/components/shared/search-bar";
import { MultiDimensionFilter } from "@/components/shared/multi-dimension-filter";
import {
  SIZE_GROUP,
  VISIBILITY_GROUP,
  DEFAULT_GROUP,
  AUTHOR_GROUP,
} from "@/components/skills/utils/skills-filters";
import type { SkillsFiltersProps } from "@/components/skills/types/skill-table";

export { hasActiveFilters } from "@/components/skills/utils/skills-filters";

/**
 * Single filter bar reused on both Skills tabs. All dimensions live behind
 * one consolidated dropdown so the bar stays uncluttered (one search input,
 * one filter button) regardless of how many dimensions the tab supports.
 */
export function SkillsFilters({
  scope,
  searchPlaceholder,
  showVisibility = false,
  showDefault = false,
  showAuthor = false,
  trailing,
}: SkillsFiltersProps) {
  const groups = [
    SIZE_GROUP,
    ...(showVisibility ? [VISIBILITY_GROUP] : []),
    ...(showDefault ? [DEFAULT_GROUP] : []),
    ...(showAuthor ? [AUTHOR_GROUP] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBar scope={scope} placeholder={searchPlaceholder} className="w-80 min-w-[16rem]" />
      <MultiDimensionFilter scope={scope} groups={groups} label="Filter" />
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
