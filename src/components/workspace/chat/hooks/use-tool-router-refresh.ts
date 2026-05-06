"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";

const MUTATION_TOOL_TYPES = new Set([
  "tool-createDesign",
  "tool-editDesign",
  "tool-deleteDesign",
  "tool-renameDesign",
  "tool-createFolder",
  "tool-moveDesign",
  "tool-moveFolder",
]);

/**
 * Triggers a router refresh whenever any file-mutating tool call completes,
 * keeping server-rendered data (e.g. file tree) in sync with AI edits.
 */
export function useToolRouterRefresh(messages: UIMessage[]) {
  const router = useRouter();
  const refreshedToolCallIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let didRefresh = false;

    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (!MUTATION_TOOL_TYPES.has(part.type)) continue;
        const p = part as { toolCallId: string; state: string };
        if (p.state !== "output-available") continue;
        if (refreshedToolCallIds.current.has(p.toolCallId)) continue;
        refreshedToolCallIds.current.add(p.toolCallId);
        didRefresh = true;
      }
    }

    if (didRefresh) router.refresh();
  }, [messages, router]);
}
