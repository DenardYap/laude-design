"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { renameProject } from "@/server/actions/projects";

/**
 * Rename a project.
 * `opts.onSuccess` is called after the server confirms (e.g. to exit editing mode).
 * `opts.onError` is called on failure (e.g. to revert optimistic label + re-open editor).
 */
export function useRenameProject(
  projectId: string,
  opts?: { onSuccess?: () => void; onError?: () => void },
) {
  const router = useRouter();

  return useMutation({
    mutationFn: (name: string) => renameProject(projectId, name),
    onSuccess: () => {
      opts?.onSuccess?.();
      router.refresh();
    },
    onError: (e) => {
      opts?.onError?.();
      toast.error(e instanceof Error ? e.message : "Failed to rename project");
    },
  });
}
