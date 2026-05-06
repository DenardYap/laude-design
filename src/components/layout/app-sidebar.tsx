"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useUiStore } from "@/stores/ui-store";
import { SidebarDesktop } from "@/components/layout/sidebar-desktop";
import { SidebarMobile } from "@/components/layout/sidebar-mobile";

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  // Auto-close the mobile drawer on route change so navigating from a nav
  // item doesn't leave the user staring at an open drawer over the new
  // page on mobile.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <>
      <SidebarDesktop
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapse={toggleSidebar}
      />
      <SidebarMobile pathname={pathname} open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}
