"use client";

import { FolderKanban } from "lucide-react";

import { CommandItem } from "@/components/ui";
import type { RecentCommandItemProps } from "@/components/layout/types/layout";
import { getNavPage } from "@/components/layout/utils/nav-pages";

export function RecentCommandItem({ row, onSelect }: RecentCommandItemProps) {
  const Icon =
    row.kind === "project" ? FolderKanban : (getNavPage(row.href)?.icon ?? FolderKanban);

  return (
    <CommandItem
      value={`recent ${row.label}`}
      onSelect={onSelect}
    >
      <Icon className="mr-2 size-3.5 text-ink-subtle" />
      <span className="truncate">{row.label}</span>
    </CommandItem>
  );
}
