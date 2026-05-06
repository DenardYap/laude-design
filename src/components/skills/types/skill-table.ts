import type { ReactNode } from "react";
import type { FilterScope } from "@/stores/filters-store";

export type PublicSortKey = "saves" | "likes" | "updated";

export interface EmptyMatchProps {
  query: string;
  filtersActive: boolean;
  onClear: () => void;
}

export interface SkillsFiltersProps {
  scope: FilterScope;
  searchPlaceholder: string;
  showVisibility?: boolean;
  showDefault?: boolean;
  /**
   * Whether to expose the Author filter (Me / Others). On `skills:mine`
   * "Others" means the skill was cloned from someone else's public skill;
   * on `skills:public` it means the public skill was authored by another user.
   */
  showAuthor?: boolean;
  /**
   * Optional slot rendered after the filter button (e.g. a SortMenu).
   */
  trailing?: ReactNode;
}

export interface ToggleRowProps {
  id: string;
  label: string;
  helper: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}
