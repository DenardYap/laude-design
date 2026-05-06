"use client";

import { Search } from "lucide-react";

import { IconButton } from "@/components/ui";
import { TopbarSearch } from "@/components/layout/topbar-search";
import type { TopbarSearchControlsProps } from "@/components/layout/types/layout";

export function TopbarSearchControls({ onOpenCommandPalette }: TopbarSearchControlsProps) {
  return (
    <>
      <div className="hidden md:block">
        <TopbarSearch />
      </div>
      <IconButton
        aria-label="Search"
        className="md:hidden"
        icon={<Search className="size-5" />}
        onClick={onOpenCommandPalette}
      />
    </>
  );
}
