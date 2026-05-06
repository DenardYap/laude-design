"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { AnswerValue, ClarifyingQuestionSetDTO } from "@/app/api/sessions/[sessionId]/questions/route";
import {
  synthesizeAnswerMessage,
  synthesizeSkipMessage,
} from "@/components/workspace/chat/questions-pane";

interface SubmitVars {
  action: "answer" | "dismiss";
  answers?: Record<string, AnswerValue>;
}

/**
 * Submit or dismiss a clarifying question set.
 * Invalidates the question set query and enqueues a synthesized chat message on success.
 */
export function useSubmitQuestionSet(sessionId: string, set: ClarifyingQuestionSetDTO) {
  const queryClient = useQueryClient();
  const enqueueChatMessage = useWorkspaceStore((s) => s.enqueueChatMessage);
  const items = set.questions.items;

  return useMutation({
    mutationFn: async ({ action, answers }: SubmitVars) => {
      const res = await fetch(`/api/sessions/${sessionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: set.id,
          action,
          answers: action === "answer" ? answers : undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      return action;
    },
    onSuccess: (action, { answers }) => {
      void queryClient.invalidateQueries({ queryKey: ["session-questions", sessionId] });
      const message =
        action === "answer"
          ? synthesizeAnswerMessage(items, answers ?? {})
          : synthesizeSkipMessage(items);
      enqueueChatMessage(sessionId, message);
    },
  });
}
