"use client";

import { useMemo } from 'react';

import { match } from "ts-pattern";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** Resolve the currently active design id (or null when on the Files tab). */
export function useActiveDesignId(projectId: string): string | null {
  const activeTab = useWorkspaceStore((s) => s.activeTabByProject[projectId] ?? "files");
  return useMemo(
    () =>
      match(activeTab)
        .with("files", () => null)
        .otherwise((tab) => tab.replace(/^design:/, "") || null),
    [activeTab],
  );
}
