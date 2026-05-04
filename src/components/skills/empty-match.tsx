"use client";

import { match } from "ts-pattern";

import { Button } from "@/components/ui";
import type { EmptyMatchProps } from "@/components/skills/types/skill-table";

export function EmptyMatch({ query, filtersActive, onClear }: EmptyMatchProps) {
  const reason = match({ hasQuery: query.trim().length > 0, filtersActive })
    .with({ hasQuery: true, filtersActive: true }, () => "No skills match your search and filters.")
    .with({ hasQuery: true, filtersActive: false }, () => "No skills match your search.")
    .with({ hasQuery: false, filtersActive: true }, () => "No skills match the active filters.")
    .otherwise(() => "No skills.");
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-6 text-sm text-ink-muted">
      <span>{reason}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
