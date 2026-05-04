"use client";

import { FolderKanban } from "lucide-react";

import { CommandItem } from "@/components/ui";
import type { RecentCommandItemProps } from "@/components/layout/types/layout";
import { getNavPage } from "@/components/layout/utils/nav-pages";

export function RecentCommandItem({ row, onSelect }: RecentCommandItemProps) {
  // Use the entry's native icon (the project folder, or the page's own icon)
  // so the user can scan the list visually and still tell which type each
  // row is — the "Recently used" heading alone doesn't communicate that.
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
