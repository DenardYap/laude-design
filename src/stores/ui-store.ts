"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;

  // Mobile-only off-canvas drawer that holds the same nav as the sidebar.
  // Distinct from `sidebarCollapsed` (which only governs the desktop rail's
  // width) — on mobile the sidebar is hidden by media query regardless and
  // this flag drives the drawer overlay.
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;

  // Global command palette (the app-shell ⌘K palette in the topbar). Note this
  // is distinct from the workspace-scoped palette in `workspace-store` — the
  // workspace palette also surfaces designs/screens for the *current* project,
  // so the two coexist rather than merging.
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
    }),
    {
      name: "laude-design:ui",
      // Don't persist the open state across reloads — it should always start
      // closed. Only `sidebarCollapsed` survives.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
