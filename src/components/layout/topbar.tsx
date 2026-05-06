"use client";

import { useEffect } from "react";

import { UserMenu } from "@/components/layout/user-menu";
import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { TopbarMobileNav } from "@/components/layout/topbar-mobile-nav";
import { TopbarSearchControls } from "@/components/layout/topbar-search-controls";
import { TopbarGithubButtons } from "@/components/layout/topbar-github-buttons";
import { useUiStore } from "@/stores/ui-store";
import type { TopbarProps } from "@/components/layout/types/layout";

export function Topbar({ user, projects, starCount }: TopbarProps) {
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  // Global ⌘K / Ctrl+K shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommandPalette]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-6">
      <TopbarMobileNav onMenuOpen={() => setMobileOpen(true)} />

      <div className="flex-1" />

      <TopbarSearchControls onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <TopbarGithubButtons starCount={starCount} />

      <div className="ml-1">
        <UserMenu user={user} size="sm" />
      </div>

      <GlobalCommandPalette projects={projects} />
    </header>
  );
}
