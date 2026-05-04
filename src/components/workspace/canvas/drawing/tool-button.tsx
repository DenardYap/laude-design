"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import type { ToolButtonProps } from "@/components/workspace/canvas/drawing/types/drawing-shape-bar";

export function ToolButton({ label, shortcut, icon, active, disabled, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "size-8 rounded-full",
            active && "bg-brand-soft text-ink ring-2 ring-brand",
          )}
          icon={icon}
          onClick={onClick}
          disabled={disabled}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col items-center gap-0.5">
        <span>{label}</span>
        {shortcut ? (
          <span className="text-[10px] opacity-60">{shortcut}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
