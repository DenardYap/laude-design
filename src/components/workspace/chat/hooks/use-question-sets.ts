"use client";

import { useQuery } from "@tanstack/react-query";

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ClarifyingQuestionSetDTO } from "@/app/api/sessions/[sessionId]/questions/route";

async function fetchSets(sessionId: string): Promise<ClarifyingQuestionSetDTO[]> {
  const res = await fetch(`/api/sessions/${sessionId}/questions`);
  if (!res.ok) throw new Error("Failed to load questions");
  const data = (await res.json()) as { sets: ClarifyingQuestionSetDTO[] };
  return data.sets;
}

/**
 * Fetches clarifying question sets for a session. Polls every 2s while the
 * agent is streaming so newly-created sets appear in real time; pauses once
 * streaming ends since no new sets can appear until the next user message.
 */
export function useQuestionSets(sessionId: string) {
  const isStreaming = useWorkspaceStore(
    (s) => Boolean(s.streamingSessionIds[sessionId]),
  );
  return useQuery({
    queryKey: ["session-questions", sessionId],
    queryFn: () => fetchSets(sessionId),
    refetchInterval: isStreaming ? 2000 : false,
    staleTime: 1000,
  });
}
