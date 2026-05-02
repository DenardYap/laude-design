"use client";

import * as React from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function useCmdKShortcut() {
  const togglePalette = useWorkspaceStore((s) => s.togglePalette);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePalette]);
}
