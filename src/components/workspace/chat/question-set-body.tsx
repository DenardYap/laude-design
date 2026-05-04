"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { AnswerValue } from "@/app/api/sessions/[sessionId]/questions/route";
import {
  QuestionBlock,
  allAnswered,
  synthesizeAnswerMessage,
  synthesizeSkipMessage,
} from "@/components/workspace/chat/questions-pane";
import type {
  QuestionSetBodyProps,
  ReadOnlyBodyProps,
} from "@/components/workspace/chat/types/questions";

export function QuestionSetBody({ sessionId, set }: QuestionSetBodyProps) {
  const items = set.questions.items;
  const queryClient = useQueryClient();
  const enqueueChatMessage = useWorkspaceStore((s) => s.enqueueChatMessage);

  // Default each question to its recommended option (or first option if none),
  // unless the set has already been answered — then mirror the saved answers.
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    if (set.answers) return set.answers;
    const init: Record<string, AnswerValue> = {};
    for (const q of items) {
      const recommended = q.options.find((o) => o.recommended);
      const fallback = q.options[0];
      const pick = recommended ?? fallback;
      if (pick) init[q.id] = { kind: "option", optionId: pick.id };
    }
    return init;
  });

  const submit = useMutation({
    mutationFn: async (action: "answer" | "dismiss") => {
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
    onSuccess: (action) => {
      void queryClient.invalidateQueries({
        queryKey: ["session-questions", sessionId],
      });
      const message =
        action === "answer"
          ? synthesizeAnswerMessage(items, answers)
          : synthesizeSkipMessage(items);
      enqueueChatMessage(sessionId, message);
    },
  });

  const isOpen = set.status === "OPEN";
  const rationale = set.questions.rationale;

  return (
    <div className="flex flex-col gap-4">
      {rationale ? (
        <p className="text-xs italic text-ink-muted">{rationale}</p>
      ) : null}
      <div className="flex flex-col gap-4">
        {items.map((q) => (
          <QuestionBlock
            key={q.id}
            question={q}
            value={answers[q.id]}
            disabled={!isOpen || submit.isPending}
            onChange={(next) =>
              setAnswers((prev) => ({ ...prev, [q.id]: next }))
            }
          />
        ))}
      </div>
      {isOpen ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => submit.mutate("dismiss")}
            disabled={submit.isPending}
          >
            <X className="size-3.5" />
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() => submit.mutate("answer")}
            disabled={submit.isPending || !allAnswered(items, answers)}
          >
            <Check className="size-3.5" />
            Send answers
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Rendered while the tool input is still streaming and the DB row doesn't
// exist yet — there's no set id to submit against, so controls are disabled
// placeholders. As soon as the input finishes streaming and the tool's
// `execute` resolves, the parent re-renders with `set` populated and
// `QuestionSetBody` takes over.
export function ReadOnlyBody({ items }: ReadOnlyBodyProps) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((q) => (
        <QuestionBlock
          key={q.id}
          question={q}
          value={undefined}
          disabled
          onChange={() => {}}
        />
      ))}
    </div>
  );
}
