"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, ExternalLink } from "lucide-react";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  MODEL_OPTIONS,
  PROVIDER_LABEL,
  PROVIDER_ORDER,
  resolveModelOption,
  type ApiKeySummary,
  type ModelOption,
  type ModelProvider,
} from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface ModelPickerProps {
  projectId: string;
  apiKeys: ApiKeySummary[];
}

type ProviderFilter = ModelProvider | "ALL";

const PROVIDER_FILTERS: ReadonlyArray<{ value: ProviderFilter; label: string }> = [
  { value: "ALL", label: "All" },
  ...PROVIDER_ORDER.map((p) => ({ value: p, label: PROVIDER_LABEL[p] })),
];

export function ModelPicker({ projectId, apiKeys }: ModelPickerProps) {
  const selected = useWorkspaceStore((s) => s.selectedModelByProject[projectId]);
  const setSelected = useWorkspaceStore((s) => s.setSelectedModel);

  const [open, setOpen] = React.useState(false);
  const [providerFilter, setProviderFilter] = React.useState<ProviderFilter>("ALL");

  const configured = React.useMemo(
    () => new Set(apiKeys.map((k) => k.provider)),
    [apiKeys],
  );

  const activeModel: ModelOption = resolveModelOption(selected);
  const activeOk = configured.has(activeModel.provider);

  const groups = React.useMemo(() => {
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
    setSelected(projectId, m.modelId, m.provider);
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
      <PopoverContent align="end" sideOffset={6} className="w-[22rem] p-0">
        <Command>
          <CommandInput placeholder="Search models…" />
          <ProviderFilterRow value={providerFilter} onChange={setProviderFilter} />
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>No models match.</CommandEmpty>
            {groups.map(({ provider, options }) => {
              const ok = configured.has(provider);
              const lastFour = apiKeys.find((k) => k.provider === provider)?.lastFour;
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

interface ProviderFilterRowProps {
  value: ProviderFilter;
  onChange: (value: ProviderFilter) => void;
}

function ProviderFilterRow({ value, onChange }: ProviderFilterRowProps) {
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

interface ProviderHeadingProps {
  provider: ModelProvider;
  configured: boolean;
  lastFour?: string;
}

function ProviderHeading({ provider, configured, lastFour }: ProviderHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{PROVIDER_LABEL[provider]}</span>
      {configured ? (
        <span className="font-mono text-[10px] text-ink-subtle">
          •••• {lastFour}
        </span>
      ) : (
        <Link
          href={`/api-keys?provider=${provider}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-warning hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="size-3" />
          Configure
          <ExternalLink className="size-2.5 opacity-70" />
        </Link>
      )}
    </div>
  );
}

interface ModelRowProps {
  model: ModelOption;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function ModelRow({ model, active, disabled, onSelect }: ModelRowProps) {
  // cmdk filters by `value`. Include label, modelId, provider name, and
  // description so a search like "haiku", "opus", "fast", or even the raw
  // model id all match.
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
