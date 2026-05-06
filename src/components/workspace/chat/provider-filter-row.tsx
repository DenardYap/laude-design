"use client";

import { PROVIDER_ORDER, PROVIDER_LABEL } from "@/lib/workspace/utils/models";
import { cn } from "@/lib/utils";
import type { ProviderFilter, ProviderFilterRowProps } from "@/components/workspace/chat/types/model-picker";

const PROVIDER_FILTERS: ReadonlyArray<{ value: ProviderFilter; label: string }> = [
  { value: "ALL", label: "All" },
  ...PROVIDER_ORDER.map((p) => ({ value: p as ProviderFilter, label: PROVIDER_LABEL[p] })),
];

export function ProviderFilterRow({ value, onChange }: ProviderFilterRowProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
      {PROVIDER_FILTERS.map((f) => {
        const active = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors",
              active
                ? "border-transparent bg-brand text-brand-foreground"
                : "border-border bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
