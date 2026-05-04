"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui";
import { useScopeQuery } from "@/stores/filters-store";
import { cn } from "@/lib/utils";
import type { SearchBarProps } from "@/components/shared/types/search-bar";

export function SearchBar({ scope, placeholder = "Search...", className }: SearchBarProps) {
  const { query, setQuery } = useScopeQuery(scope);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="rounded-full pl-9 pr-9"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
