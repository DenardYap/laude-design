"use client";

import type { Ref } from "react";
import { Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import { TAB_BASE, TAB_ACTIVE, TAB_INACTIVE } from "@/components/workspace/canvas/utils/tab-styles";

export function FilesTab({
  ref,
  active,
  onClick,
}: {
  ref?: Ref<HTMLButtonElement>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(TAB_BASE, "ml-2", active ? TAB_ACTIVE : TAB_INACTIVE)}
    >
      <Folder className="size-3.5" />
      Files
    </button>
  );
}
