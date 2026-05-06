"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { setProjectSkillEffective } from "@/server/actions/skills";

interface ToggleSkillVars {
  skillId: string;
  applied: boolean;
}

/**
 * Toggle a skill on/off for a project and invalidate the project-skill-states query.
 */
export function useToggleProjectSkill(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skillId, applied }: ToggleSkillVars) =>
      setProjectSkillEffective(projectId, skillId, applied),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-skill-states", projectId],
      });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to update skill");
    },
  });
}
