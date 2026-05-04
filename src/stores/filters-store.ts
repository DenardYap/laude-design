"use client";

import { useCallback } from 'react';
import { create } from "zustand";

export type FilterScope = "projects" | "skills:mine" | "skills:public" | "api-keys";

interface ScopeState {
  query: string;
  /** Keyed by dimension name (e.g. "recency", "size", "creator"). */
  dimensions: Record<string, string[]>;
}

interface FiltersState {
  scopes: Record<FilterScope, ScopeState>;
  setQuery: (scope: FilterScope, query: string) => void;
  setDimension: (scope: FilterScope, dimension: string, values: string[]) => void;
  toggleValue: (scope: FilterScope, dimension: string, value: string) => void;
  resetDimension: (scope: FilterScope, dimension: string) => void;
  resetAll: (scope: FilterScope) => void;
}

const empty = (): ScopeState => ({ query: "", dimensions: {} });

export const useFiltersStore = create<FiltersState>((set) => ({
  scopes: {
    projects: empty(),
    "skills:mine": empty(),
    "skills:public": empty(),
    "api-keys": empty(),
  },
  setQuery: (scope, query) =>
    set((s) => ({
      scopes: { ...s.scopes, [scope]: { ...s.scopes[scope], query } },
    })),
  setDimension: (scope, dimension, values) =>
    set((s) => ({
      scopes: {
        ...s.scopes,
        [scope]: {
          ...s.scopes[scope],
          dimensions: { ...s.scopes[scope].dimensions, [dimension]: values },
        },
      },
    })),
  toggleValue: (scope, dimension, value) =>
    set((s) => {
      const current = s.scopes[scope].dimensions[dimension] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        scopes: {
          ...s.scopes,
          [scope]: {
            ...s.scopes[scope],
            dimensions: { ...s.scopes[scope].dimensions, [dimension]: next },
          },
        },
      };
    }),
  resetDimension: (scope, dimension) =>
    set((s) => {
      const next = { ...s.scopes[scope].dimensions };
      delete next[dimension];
      return {
        scopes: { ...s.scopes, [scope]: { ...s.scopes[scope], dimensions: next } },
      };
    }),
  resetAll: (scope) => set((s) => ({ scopes: { ...s.scopes, [scope]: empty() } })),
}));

const EMPTY_VALUES: string[] = [];

/** Subscribe to the current search query for a scope. */
export function useScopeQuery(scope: FilterScope) {
  const query = useFiltersStore((s) => s.scopes[scope].query);
  const setQuery = useFiltersStore((s) => s.setQuery);
  return {
    query,
    setQuery: useCallback((q: string) => setQuery(scope, q), [scope, setQuery]),
  };
}

/** Subscribe to a specific filter dimension; only re-renders when its values change. */
export function useScopeDimension(scope: FilterScope, dimension: string) {
  const values = useFiltersStore(
    (s) => s.scopes[scope].dimensions[dimension] ?? EMPTY_VALUES,
  );
  const setDimension = useFiltersStore((s) => s.setDimension);
  const toggleValue = useFiltersStore((s) => s.toggleValue);
  const resetDimension = useFiltersStore((s) => s.resetDimension);
  return {
    values,
    setValues: useCallback(
      (next: string[]) => setDimension(scope, dimension, next),
      [scope, dimension, setDimension],
    ),
    toggle: useCallback(
      (value: string) => toggleValue(scope, dimension, value),
      [scope, dimension, toggleValue],
    ),
    reset: useCallback(
      () => resetDimension(scope, dimension),
      [scope, dimension, resetDimension],
    ),
  };
}

/** Subscribe to the entire dimensions map for a scope. Use sparingly. */
export function useScopeDimensions(scope: FilterScope) {
  return useFiltersStore((s) => s.scopes[scope].dimensions);
}

/** Reset everything (query + all dimensions) for a scope. */
export function useResetScope(scope: FilterScope) {
  const resetAll = useFiltersStore((s) => s.resetAll);
  return useCallback(() => resetAll(scope), [scope, resetAll]);
}
