"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";

interface CreateDesignToolPart {
  toolCallId: string;
  state: string;
  input?: {
    name?: string;
    content?: string;
    folderId?: string | null;
  };
  output?: {
    designId?: string;
    name?: string;
    folderId?: string | null;
  };
}

interface UseDesignAutoNavigateOptions {
  messages: UIMessage[];
  projectId: string;
}

/**
 * Watches for completed `createDesign` tool calls and automatically opens
 * the newly created design in the canvas, registering it as a pending
 * optimistic entry so the file tree reflects it immediately.
 */
export function useDesignAutoNavigate({ messages, projectId }: UseDesignAutoNavigateOptions) {
  const openDesignTab = useWorkspaceStore((s) => s.openDesignTab);
  const addPendingDesign = useOptimisticFilesStore((s) => s.addPendingDesign);
  const navigatedToolCallIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (part.type !== "tool-createDesign") continue;
        const p = part as CreateDesignToolPart;
        if (p.state !== "output-available") continue;
        if (navigatedToolCallIds.current.has(p.toolCallId)) continue;

        const designId = p.output?.designId;
        if (!designId) continue;

        navigatedToolCallIds.current.add(p.toolCallId);

        const name = p.output?.name ?? p.input?.name ?? "Untitled design";
        const folderId = p.output?.folderId ?? p.input?.folderId ?? null;
        const content = p.input?.content ?? "";

        addPendingDesign({
          id: designId,
          name,
          folderId,
          files: content ? [{ path: "/App.tsx", content }] : [],
          updatedAt: new Date().toISOString(),
        });
        openDesignTab(projectId, designId);
      }
    }
  }, [messages, openDesignTab, projectId, addPendingDesign]);
}
