"use client";

import { ChevronsLeft } from "lucide-react";

import { IconButton, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import { EASE, DURATION } from "@/components/layout/utils/sidebar";
import type { SidebarCollapseToggleProps } from "@/components/layout/types/layout";

export function SidebarCollapseToggle({ collapsed, onToggleCollapse }: SidebarCollapseToggleProps) {
  return (
    <div className="flex justify-start px-3 py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
            icon={
              <ChevronsLeft
                style={{ transitionTimingFunction: EASE }}
                className={cn("size-4 transition-transform", DURATION, collapsed && "rotate-180")}
              />
            }
          />
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? "Expand" : "Collapse"}
          <span className="ml-2 text-ink-muted">⌘B</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
