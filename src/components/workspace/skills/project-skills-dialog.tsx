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
  Pill,
  Skeleton,
  Switch,
} from "@/components/ui";
import {
  getProjectSkillStates,
  setProjectSkillEffective,
  type ProjectSkillState,
} from "@/server/actions/skills";

interface ProjectSkillsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

function SkillRow({
  skill,
  pending,
  onToggle,
}: {
  skill: ProjectSkillState;
  pending: boolean;
  onToggle: (applied: boolean) => void;
}) {
  const isOverridden = skill.overrideApplied !== null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-surface-sunken">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{skill.name}</span>
          {isOverridden ? (
            <Pill tone="warning" className="shrink-0">
              Overridden
            </Pill>
          ) : null}
        </div>
        {skill.description ? (
          <p className="line-clamp-1 text-xs text-ink-muted">{skill.description}</p>
        ) : null}
      </div>
      <Switch
        checked={skill.effective}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-label={`Toggle ${skill.name} for this project`}
      />
    </div>
  );
}

function SkillListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}
