"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui";
import type { AnswerValue } from "@/app/api/sessions/[sessionId]/questions/route";
import { QuestionBlock, allAnswered } from "@/components/workspace/chat/questions-pane";
import { useSubmitQuestionSet } from "@/components/workspace/chat/hooks/use-submit-question-set";
import type { QuestionSetBodyProps } from "@/components/workspace/chat/types/questions";

export function QuestionSetBody({ sessionId, set }: QuestionSetBodyProps) {
  const items = set.questions.items;

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

  const submit = useSubmitQuestionSet(sessionId, set);

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
            onClick={() => submit.mutate({ action: "dismiss" })}
            disabled={submit.isPending}
          >
            <X className="size-3.5" />
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() => submit.mutate({ action: "answer", answers })}
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
