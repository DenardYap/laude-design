"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { renameSession } from "@/server/actions/sessions";
import type { ChatSessionDTO } from "@/lib/workspace/types";

/**
 * Rename a chat session with optimistic-like UX.
 * `onSuccess` is called after the server confirms — use it to dismiss the rename input.
 */
export function useRenameSession(session: ChatSessionDTO, opts?: { onSuccess?: () => void }) {
  const router = useRouter();

  return useMutation({
    mutationFn: async (title: string) => {
      await renameSession(session.id, title);
      return title.trim().slice(0, 80) || "Untitled";
    },
    onSuccess: (newTitle) => {
      opts?.onSuccess?.();
      toast.success(`Renamed session to "${newTitle}"`);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to rename"),
  });
}
