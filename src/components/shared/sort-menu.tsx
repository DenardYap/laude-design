"use client";

import { ArrowDownUp, Check } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SortMenuProps } from "@/components/shared/types/sort-menu";

export type { SortOption } from "@/components/shared/types/sort-menu";

/**
 * Single-select sort dropdown that mirrors the look of `MultiDimensionFilter`
 * so they sit together in the same toolbar without one feeling out of place.
 *
 * Uses `DropdownMenu` (not `Command`) because sort is a tiny, finite,
 * non-searchable list — pulling in a search input would add noise without
 * paying for itself.
 */
export function SortMenu<TValue extends string>({
  value,
  onChange,
  options,
  label = "Sort by",
  triggerVariant = "outline",
}: SortMenuProps<TValue>) {
  const active = options.find((o) => o.value === value);
  const triggerText = active?.triggerLabel ?? active?.label ?? "Default";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={triggerVariant} size="md" aria-label={`${label}: ${triggerText}`}>
          <ArrowDownUp className="size-4" />
          <span className="text-ink-muted">Sort:</span>
          <span>{triggerText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              className={cn("cursor-pointer pl-8", selected && "font-medium text-ink")}
            >
              {selected ? (
                <Check className="absolute left-2 size-4 text-ink" aria-hidden />
              ) : null}
              {opt.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
