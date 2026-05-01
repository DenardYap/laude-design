"use client";

import { create } from "zustand";

export type FilterScope = "projects" | "skills:mine" | "skills:public";

interface ScopeState {
  query: string;
  filters: string[];
}

interface FiltersState {
  scopes: Record<FilterScope, ScopeState>;
  setQuery: (scope: FilterScope, query: string) => void;
  setFilters: (scope: FilterScope, filters: string[]) => void;
  toggleFilter: (scope: FilterScope, value: string) => void;
  reset: (scope: FilterScope) => void;
}

const empty = (): ScopeState => ({ query: "", filters: [] });

export const useFiltersStore = create<FiltersState>((set) => ({
  scopes: {
    projects: empty(),
    "skills:mine": empty(),
    "skills:public": empty(),
  },
  setQuery: (scope, query) =>
    set((s) => ({
      scopes: { ...s.scopes, [scope]: { ...s.scopes[scope], query } },
    })),
  setFilters: (scope, filters) =>
    set((s) => ({
      scopes: { ...s.scopes, [scope]: { ...s.scopes[scope], filters } },
    })),
  toggleFilter: (scope, value) =>
    set((s) => {
      const current = s.scopes[scope].filters;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { scopes: { ...s.scopes, [scope]: { ...s.scopes[scope], filters: next } } };
    }),
  reset: (scope) =>
    set((s) => ({ scopes: { ...s.scopes, [scope]: empty() } })),
}));

export function useScopeFilters(scope: FilterScope) {
  const state = useFiltersStore((s) => s.scopes[scope]);
  const setQuery = useFiltersStore((s) => s.setQuery);
  const setFilters = useFiltersStore((s) => s.setFilters);
  const toggleFilter = useFiltersStore((s) => s.toggleFilter);
  const reset = useFiltersStore((s) => s.reset);
  return {
    query: state.query,
    filters: state.filters,
    setQuery: (q: string) => setQuery(scope, q),
    setFilters: (f: string[]) => setFilters(scope, f),
    toggleFilter: (v: string) => toggleFilter(scope, v),
    reset: () => reset(scope),
  };
}
