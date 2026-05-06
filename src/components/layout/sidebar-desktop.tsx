"use client";

import { cn } from "@/lib/utils";
import { SidebarBody } from "@/components/layout/sidebar-body";
import { EASE, DURATION } from "@/components/layout/utils/sidebar";
import type { SidebarDesktopProps } from "@/components/layout/types/layout";

export function SidebarDesktop({ pathname, collapsed, onToggleCollapse }: SidebarDesktopProps) {
  return (
    <aside
      style={{ transitionTimingFunction: EASE }}
      className={cn(
        "hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] md:flex",
        DURATION,
        collapsed ? "w-16" : "w-60",
      )}
    >
      <SidebarBody
        pathname={pathname}
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapse={onToggleCollapse}
      />
    </aside>
  );
}
