"use client";

import type { ReactNode } from 'react';

import { SearchBar } from "@/components/shared/search-bar";
import {
  MultiDimensionFilter,
  type FilterGroup,
} from "@/components/shared/multi-dimension-filter";
import type { FilterScope } from "@/stores/filters-store";
import { SKILL_SIZE_OPTIONS } from "./skill-size";

interface SkillsFiltersProps {
  scope: FilterScope;
  searchPlaceholder: string;
  showVisibility?: boolean;
  showDefault?: boolean;
  /**
   * Whether to expose the Author filter (Me / Others). On `skills:mine`
   * "Others" means the skill was cloned from someone else's public skill;
   * on `skills:public` it means the public skill was authored by another
   * user.
   */
  showAuthor?: boolean;
  /**
   * Optional slot rendered after the filter button (e.g. a SortMenu). Kept
   * generic so each tab can mount tab-specific controls without having to
   * fork the whole toolbar.
   */
  trailing?: ReactNode;
}

const SIZE_GROUP: FilterGroup = {
  dimension: "size",
  label: "Tokens",
  options: SKILL_SIZE_OPTIONS,
};

const VISIBILITY_GROUP: FilterGroup = {
  dimension: "visibility",
  label: "Visibility",
  options: [
    { value: "public", label: "Public" },
    { value: "private", label: "Private" },
  ],
};

const DEFAULT_GROUP: FilterGroup = {
  dimension: "default",
  label: "Default applied",
  options: [
    { value: "on", label: "Applied to all projects" },
    { value: "off", label: "Not applied" },
  ],
};

const AUTHOR_GROUP: FilterGroup = {
  dimension: "author",
  label: "Author",
  options: [
    { value: "me", label: "Me" },
    { value: "others", label: "Others" },
  ],
};

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
  const groups: FilterGroup[] = [
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

/** True when the user has any non-default filter state in this scope. */
export function hasActiveFilters(query: string, dimensionValues: string[][]): boolean {
  return query.trim().length > 0 || dimensionValues.some((arr) => arr.length > 0);
}
