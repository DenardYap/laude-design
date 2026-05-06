"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  MODEL_OPTIONS,
  PROVIDER_ORDER,
  resolveModelOption,
} from "@/lib/workspace/utils/models";
import type { ModelOption, ModelProvider } from "@/lib/workspace/utils/models";
import { resolveSessionModel, useWorkspaceStore } from "@/stores/workspace-store";
import { useConfiguredApiKeys } from "@/lib/api/api-keys";
import { ProviderFilterRow } from "@/components/workspace/chat/provider-filter-row";
import { ProviderHeading } from "@/components/workspace/chat/provider-heading";
import { ModelRow } from "@/components/workspace/chat/model-row";
import type {
  ModelPickerProps,
  ProviderFilter,
} from "@/components/workspace/chat/types/model-picker";

export function ModelPicker({ projectId, sessionId }: ModelPickerProps) {
  const selected = useWorkspaceStore(
    (s) => resolveSessionModel(sessionId, projectId, s),
  );
  const setSelected = useWorkspaceStore((s) => s.setSelectedModel);
  const { configured, lastFourByProvider } = useConfiguredApiKeys();

  const [open, setOpen] = useState(false);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("ALL");

  const activeModel: ModelOption = resolveModelOption(selected);
  const activeOk = configured.has(activeModel.provider);

  const groups = useMemo(() => {
    const visible =
      providerFilter === "ALL"
        ? MODEL_OPTIONS
        : MODEL_OPTIONS.filter((m) => m.provider === providerFilter);
    const byProvider = new Map<ModelProvider, ModelOption[]>();
    for (const m of visible) {
      const list = byProvider.get(m.provider) ?? [];
      list.push(m);
      byProvider.set(m.provider, list);
    }
    return PROVIDER_ORDER.flatMap((p) => {
      const list = byProvider.get(p);
      return list ? [{ provider: p, options: list }] : [];
    });
  }, [providerFilter]);

  function handleSelect(m: ModelOption) {
    if (!configured.has(m.provider)) return;
    setSelected(projectId, sessionId, m.modelId, m.provider);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 max-w-[12rem] gap-1 rounded-full border border-border px-2 text-xs",
            !activeOk && "border-warning/50 text-warning",
          )}
        >
          {!activeOk ? <AlertTriangle className="size-3 shrink-0" /> : null}
          <span className="truncate">{activeModel.label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(22rem,calc(100vw-1rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Search models…" />
          <ProviderFilterRow value={providerFilter} onChange={setProviderFilter} />
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>No models match.</CommandEmpty>
            {groups.map(({ provider, options }) => {
              const ok = configured.has(provider);
              const lastFour = lastFourByProvider.get(provider);
              return (
                <CommandGroup
                  key={provider}
                  heading={
                    <ProviderHeading
                      provider={provider}
                      configured={ok}
                      lastFour={lastFour}
                    />
                  }
                >
                  {options.map((m) => (
                    <ModelRow
                      key={m.modelId}
                      model={m}
                      active={m.modelId === activeModel.modelId}
                      disabled={!ok}
                      onSelect={() => handleSelect(m)}
                    />
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
