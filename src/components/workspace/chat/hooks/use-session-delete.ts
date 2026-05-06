"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ChatSessionDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { deleteSession } from "@/server/actions/sessions";

export function useSessionDelete(projectId: string, sessions: ChatSessionDTO[]) {
  const router = useRouter();
  const closeSessionTab = useWorkspaceStore((s) => s.closeSessionTab);
  const deleteConfirmSessionId = useWorkspaceStore((s) => s.deleteConfirmSessionId);
  const clearSessionDeleteConfirm = useWorkspaceStore((s) => s.clearSessionDeleteConfirm);

  const mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const title = sessions.find((s) => s.id === sessionId)?.title ?? "Session";
      await deleteSession(sessionId);
      return title;
    },
    onSuccess: (title) => {
      toast.success(`Deleted "${title}"`);
      router.refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to delete session"),
  });

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmSessionId) return;
    closeSessionTab(projectId, deleteConfirmSessionId);
    await mutation.mutateAsync(deleteConfirmSessionId);
    clearSessionDeleteConfirm();
  }, [clearSessionDeleteConfirm, closeSessionTab, deleteConfirmSessionId, projectId, mutation]);

  const deletingSession = deleteConfirmSessionId
    ? (sessions.find((s) => s.id === deleteConfirmSessionId) ?? null)
    : null;

  return { handleConfirmDelete, deletingSession };
}
