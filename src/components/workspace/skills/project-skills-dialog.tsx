"use client";

import { Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  EmptyState,
} from "@/components/ui";
import {
  getProjectSkillStates,
  setProjectSkillEffective,
} from "@/server/actions/skills";
import type { ProjectSkillsDialogProps } from "@/components/workspace/skills/types/skills";
import { SkillRow } from "@/components/workspace/skills/skill-row";
import { SkillListSkeleton } from "@/components/workspace/skills/skill-list-skeleton";

export function ProjectSkillsDialog({
  projectId,
  open,
  onOpenChange,
}: ProjectSkillsDialogProps) {
  const queryClient = useQueryClient();

  const { data: skills, isLoading } = useQuery({
    queryKey: ["project-skill-states", projectId],
    queryFn: () => getProjectSkillStates(projectId),
    enabled: open,
  });

  const toggle = useMutation({
    mutationFn: ({
      skillId,
      applied,
    }: {
      skillId: string;
      applied: boolean;
    }) => setProjectSkillEffective(projectId, skillId, applied),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-skill-states", projectId],
      });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to update skill");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project skills</DialogTitle>
          <DialogDescription>
            Choose which of your skills the agent uses in this project. The default for each
            skill is set on the Skills page.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-1">
          {isLoading ? (
            <SkillListSkeleton />
          ) : !skills || skills.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title="No skills yet"
              description="Upload skills on the Skills page to use them as agent context."
              action={
                <Button variant="outline" size="sm" asChild>
                  <a href="/skills" target="_blank" rel="noopener noreferrer">
                    Go to Skills
                  </a>
                </Button>
              }
            />
          ) : (
            skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                pending={toggle.isPending}
                onToggle={(applied) =>
                  toggle.mutate({ skillId: skill.id, applied })
                }
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
