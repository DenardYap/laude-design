"use client";

import * as React from "react";
import { Check, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useScopeFilters, type FilterScope } from "@/stores/filters-store";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  scope: FilterScope;
  options: FilterOption[];
  label?: string;
  triggerVariant?: "outline" | "ghost";
  showAsIcon?: boolean;
}

export function MultiSelectFilter({
  scope,
  options,
  label = "Filter",
  triggerVariant = "outline",
  showAsIcon = false,
}: MultiSelectFilterProps) {
  const { filters, toggleFilter, reset } = useScopeFilters(scope);
  const count = filters.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={triggerVariant}
          size={showAsIcon ? "icon" : "default"}
          className={cn(showAsIcon && "rounded-full")}
          aria-label={label}
        >
          <Filter className="size-4" />
          {!showAsIcon ? <span>{label}</span> : null}
          {count > 0 ? (
            <Badge variant="secondary" className="ml-1 h-5 rounded-full px-2 text-[10px]">
              {count}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>No options.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = filters.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => toggleFilter(opt.value)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50",
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
