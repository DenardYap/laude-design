"use client";

import { useMemo } from "react";

import { Button, EmptyState } from "@/components/ui";
import { SearchBar } from "@/components/shared/search-bar";
import { useScopeQuery } from "@/stores/filters-store";
import { ApiKeyRow } from "./api-key-row";
import type { ApiKeysListProps } from "@/components/api-keys/types/api-keys";

export function ApiKeysList({ providers, existingByProvider }: ApiKeysListProps) {
  const { query, setQuery } = useScopeQuery("api-keys");
  const normalized = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalized) return providers;
    return providers.filter((p) => p.name.toLowerCase().includes(normalized));
  }, [providers, normalized]);

  return (
    <div className="space-y-3">
      <SearchBar
        scope="api-keys"
        placeholder="Search providers (Anthropic, Google, OpenAI)..."
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching providers"
          description={`No provider matches "${query}". Try a different search.`}
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {filtered.map((config) => (
            <ApiKeyRow
              key={config.provider}
              config={config}
              existing={existingByProvider.get(config.provider)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
