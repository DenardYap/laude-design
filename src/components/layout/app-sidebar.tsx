"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@/components/ui";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { SidebarBody } from "@/components/layout/sidebar-body";
import { NAV_ITEMS, EASE, DURATION } from "@/components/layout/utils/sidebar";

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
      <aside
        style={{ transitionTimingFunction: EASE }}
        className={cn(
          // Hidden below `md` — the topbar hamburger opens the drawer
          // version below on small screens. `md:flex` mirrors Tailwind's
          // 768px breakpoint, which is the same threshold the workspace
          // uses to switch from split-pane to chat/canvas tabs.
          "hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] md:flex",
          DURATION,
          collapsed ? "w-16" : "w-60",
        )}
      >
        <SidebarBody
          pathname={pathname}
          collapsed={collapsed}
          showCollapseToggle
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          showDefaultClose={false}
          className="left-0 top-0 h-[100dvh] w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-0 border-r border-border bg-surface p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-3 py-3">
              <Link
                href="/projects"
                className="flex min-w-0 items-center gap-2"
                onClick={() => setMobileOpen(false)}
              >
                <Image
                  src="/logo.png"
                  alt="Laude Design"
                  width={36}
                  height={36}
                  className="size-9 shrink-0"
                  priority
                />
                <span className="text-sm font-semibold tracking-tight text-ink">
                  Laude Design
                </span>
              </Link>
              <IconButton
                aria-label="Close menu"
                icon={<X className="size-4" />}
                onClick={() => setMobileOpen(false)}
              />
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/40 text-ink"
                        : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
