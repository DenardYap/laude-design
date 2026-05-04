"use client";

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
import { useScopeDimension, type FilterScope } from "@/stores/filters-store";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  scope: FilterScope;
  /**
   * Filter dimension (e.g. "recency", "size", "creator"). Each dimension is
   * an independent multi-select; dimensions combine with AND across the row.
   */
  dimension: string;
  options: FilterOption[];
  label?: string;
  triggerVariant?: "outline" | "ghost";
  showAsIcon?: boolean;
}

export function MultiSelectFilter({
  scope,
  dimension,
  options,
  label = "Filter",
  triggerVariant = "outline",
  showAsIcon = false,
}: MultiSelectFilterProps) {
  const { values, toggle, reset } = useScopeDimension(scope, dimension);
  const count = values.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {showAsIcon ? (
          <Button
            variant={triggerVariant}
            size="icon"
            className="relative rounded-full"
            aria-label={count > 0 ? `${label} (${count} active)` : label}
          >
            <Filter className="size-4" />
            {count > 0 ? (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium leading-none text-brand-foreground shadow-sm ring-2 ring-background"
              >
                {count}
              </span>
            ) : null}
          </Button>
        ) : (
          <Button variant={triggerVariant} size="md" aria-label={label}>
            <Filter className="size-4" />
            <span>{label}</span>
            {count > 0 ? (
              <Pill tone="brand" className="ml-1 h-5 px-2 text-[10px]">
                {count}
              </Pill>
            ) : null}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>No options.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = values.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => toggle(opt.value)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-brand",
                        isSelected ? "bg-brand text-brand-foreground" : "opacity-50",
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </div>
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {count > 0 ? (
            <div className="border-t border-border p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => reset()}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
