"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui";
import { UserMenu } from "@/components/layout/user-menu";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { WorkspaceHeaderActionsProps } from "@/components/workspace/types/workspace";

export function WorkspaceHeaderActions({ user, onSkillsOpen }: WorkspaceHeaderActionsProps) {
  const setExportOpen = useWorkspaceStore((s) => s.setExportOpen);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full px-2 sm:px-3"
        onClick={onSkillsOpen}
        aria-label="Skills"
      >
        <Sparkles className="size-3.5" />
        <span className="hidden sm:inline">Skills</span>
      </Button>
      <Button
        variant="primary"
        size="sm"
        className="rounded-full px-2 sm:px-3"
        onClick={() => setExportOpen(true)}
      >
        <span className="hidden sm:inline">Export to Agent</span>
        <span className="sm:hidden">Export</span>
      </Button>
      <UserMenu user={user} size="sm" />
    </div>
  );
}
