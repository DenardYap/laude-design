"use client";

import { Check } from "lucide-react";

import { CommandItem } from "@/components/ui";
import { PROVIDER_LABEL } from "@/lib/workspace/utils/models";
import type { ModelRowProps } from "@/components/workspace/chat/types/model-picker";

export function ModelRow({ model, active, disabled, onSelect }: ModelRowProps) {
  const value = `${model.label} ${model.modelId} ${PROVIDER_LABEL[model.provider]} ${model.description ?? ""}`;
  return (
    <CommandItem
      value={value}
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-start justify-between gap-2"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{model.label}</span>
        {model.description ? (
          <span className="truncate text-[11px] text-ink-muted">
            {model.description}
          </span>
        ) : (
          <span className="truncate font-mono text-[10px] text-ink-subtle">
            {model.modelId}
          </span>
        )}
      </span>
      {active ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-brand-foreground" />
      ) : null}
    </CommandItem>
  );
}
