import type { ProjectSkillState } from "@/server/actions/skills";

export interface ProjectSkillsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SkillRowProps {
  skill: ProjectSkillState;
  pending: boolean;
  onToggle: (applied: boolean) => void;
}
