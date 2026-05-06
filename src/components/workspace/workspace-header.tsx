"use client";

import { useState } from "react";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { ProjectSkillsDialog } from "@/components/workspace/skills/project-skills-dialog";
import { WorkspaceHeaderNav } from "@/components/workspace/workspace-header-nav";
import { WorkspaceHeaderActions } from "@/components/workspace/workspace-header-actions";
import type { WorkspaceHeaderProps } from "@/components/workspace/types/workspace";

export function WorkspaceHeader({ projectId, projectName, user }: WorkspaceHeaderProps) {
  const [skillsOpen, setSkillsOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-surface px-2 sm:px-4 sm:gap-3">
      <WorkspaceHeaderNav projectId={projectId} projectName={projectName} />
      <WorkspaceHeaderActions user={user} onSkillsOpen={() => setSkillsOpen(true)} />

      <ProjectSkillsDialog
        projectId={projectId}
        open={skillsOpen}
        onOpenChange={setSkillsOpen}
      />
    </header>
  );
}
