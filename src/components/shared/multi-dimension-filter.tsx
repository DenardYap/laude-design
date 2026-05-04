"use client";

import { useMemo } from "react";
import { Check, Filter } from "lucide-react";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Pill,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import {
  useFiltersStore,
  useScopeDimensions,
} from "@/stores/filters-store";
import { cn } from "@/lib/utils";
import type { MultiDimensionFilterProps } from "@/components/shared/types/filter";

export type { FilterGroup } from "@/components/shared/types/filter";

/**
 * Single-popover filter that exposes several independent dimensions at once.
 * Each dimension is a multi-select group; selections within a dimension OR
 * together, dimensions AND together, matching the convention used by Linear,
 * Notion, etc.
 */
export function MultiDimensionFilter({
  scope,
  groups,
  label = "Filter",
  triggerVariant = "outline",
}: MultiDimensionFilterProps) {
  const dimensions = useScopeDimensions(scope);
  const toggleValue = useFiltersStore((s) => s.toggleValue);
  const setDimension = useFiltersStore((s) => s.setDimension);

  const totalActive = useMemo(
    () =>
      groups.reduce(
        (sum, g) => sum + (dimensions[g.dimension]?.length ?? 0),
        0,
      ),
    [groups, dimensions],
  );

  function clearAll() {
    for (const g of groups) {
      if ((dimensions[g.dimension]?.length ?? 0) > 0) {
        setDimension(scope, g.dimension, []);
      }
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={triggerVariant} size="md" aria-label={label}>
          <Filter className="size-4" />
          <span>{label}</span>
          {totalActive > 0 ? (
            <Pill tone="brand" className="ml-1 h-5 px-2 text-[10px]">
              {totalActive}
            </Pill>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Filter…" />
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>No options.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.dimension} heading={group.label}>
                {group.options.map((opt) => {
                  const selected =
                    dimensions[group.dimension]?.includes(opt.value) ?? false;
                  return (
                    <CommandItem
                      key={`${group.dimension}:${opt.value}`}
                      // Searchable value combines the dimension label so users
                      // can type "size small" or just "small" and find it.
                      value={`${group.label} ${opt.label}`}
                      onSelect={() => toggleValue(scope, group.dimension, opt.value)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex size-4 items-center justify-center rounded-sm border border-brand",
                          selected ? "bg-brand text-brand-foreground" : "opacity-50",
                        )}
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </div>
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {totalActive > 0 ? (
            <div className="border-t border-border p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={clearAll}
              >
                Clear all filters
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
