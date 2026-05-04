import type { FilterScope } from "@/stores/filters-store";

export interface FilterGroup {
  dimension: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface MultiDimensionFilterProps {
  scope: FilterScope;
  groups: FilterGroup[];
  /** Trigger label when no filters are active. */
  label?: string;
  triggerVariant?: "outline" | "ghost";
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterProps {
  scope: FilterScope;
  /**
   * Filter dimension (e.g. "recency", "size", "creator"). Each dimension is
   * an independent multi-select; dimensions combine with AND across the row.
   */
  dimension: string;
  options: FilterOption[];
  label?: string;
  triggerVariant?: "outline" | "ghost";
  showAsIcon?: boolean;
}
