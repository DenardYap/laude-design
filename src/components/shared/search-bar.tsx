"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useScopeFilters, type FilterScope } from "@/stores/filters-store";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  scope: FilterScope;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ scope, placeholder = "Search...", className }: SearchBarProps) {
  const { query, setQuery } = useScopeFilters(scope);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
