"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { uploadAttachment } from "@/lib/api/uploads";

/**
 * Upload a file attachment for the current session.
 * `sessionId` is captured at call time — pass the active composer session ID.
 */
export function useUploadAttachment(projectId: string, sessionId: string) {
  const addAttachment = useWorkspaceStore((s) => s.addPendingAttachment);

  return useMutation({
    mutationFn: (file: File) => uploadAttachment(projectId, file),
    onSuccess: (file) => addAttachment(sessionId, file),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });
}
