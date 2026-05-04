import type { FilterScope } from "@/stores/filters-store";

export interface SearchBarProps {
  scope: FilterScope;
  placeholder?: string;
  className?: string;
}
