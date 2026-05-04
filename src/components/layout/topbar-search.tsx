"use client";

import { useEffect, useState } from 'react';
import { Search } from "lucide-react";

import { useUiStore } from "@/stores/ui-store";

/**
 * Looks like a rounded search input but is actually a button. Clicking (or
 * focusing + pressing Enter/Space) opens the global command palette. The
 * trailing badge advertises the ⌘K shortcut so the affordance is discoverable
 * without a label.
 */
export function TopbarSearch() {
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [shortcutLabel, setShortcutLabel] = useState("⌘K");

  // Show "Ctrl K" on Windows/Linux. Runs once on mount; keeps SSR markup
  // stable (defaults to ⌘K) and only swaps after hydration.
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    if (!isMac) setShortcutLabel("Ctrl K");
  }, []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Search and open command palette"
      className="group flex h-9 w-64 items-center gap-2 rounded-full border border-input bg-surface px-3 text-sm text-ink-subtle shadow-sm transition-colors hover:border-border-strong hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search...</span>
      <kbd className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-muted">
        {shortcutLabel}
      </kbd>
    </button>
  );
}
