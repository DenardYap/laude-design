import type { FilterScope } from "@/stores/filters-store";

export interface FilterGroup {
  dimension: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface MultiDimensionFilterProps {
  scope: FilterScope;
  groups: FilterGroup[];
  label?: string;
  triggerVariant?: "outline" | "ghost";
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterProps {
  scope: FilterScope;
  dimension: string;
  options: FilterOption[];
  label?: string;
  triggerVariant?: "outline" | "ghost";
  showAsIcon?: boolean;
}
