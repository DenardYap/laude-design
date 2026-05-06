"use client";

import type { SidebarBodyProps } from "@/components/layout/types/layout";
import { SidebarLogo } from "@/components/layout/sidebar-logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarCollapseToggle } from "@/components/layout/sidebar-collapse-toggle";

export function SidebarBody({
  pathname,
  collapsed,
  showCollapseToggle,
  onToggleCollapse,
}: SidebarBodyProps) {
  return (
    <>
      <SidebarLogo collapsed={collapsed} />
      <SidebarNav pathname={pathname} collapsed={collapsed} />
      {showCollapseToggle ? (
        <SidebarCollapseToggle collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      ) : null}
    </>
  );
}
