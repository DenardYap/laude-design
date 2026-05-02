"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, HelpCircle, Loader2, X } from "lucide-react";
import { match } from "ts-pattern";

import { Button } from "@/components/ui";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type {
  AnswerValue,
  ClarifyingQuestionItem,
  ClarifyingQuestionSetDTO,
} from "@/app/api/sessions/[sessionId]/questions/route";
import {
  QuestionBlock,
  allAnswered,
  synthesizeAnswerMessage,
  synthesizeSkipMessage,
  useQuestionSets,
} from "@/components/workspace/chat/questions-pane";

interface InlineClarifyingQuestionsProps {
  sessionId: string;
  /** Question set id from the tool call's output. Undefined while the tool is still streaming. */
  questionSetId?: string;
  /** Pulled from the tool call's input so the questions render before output lands. */
  fallbackRationale?: string;
  fallbackItems?: ClarifyingQuestionItem[];
}

export function InlineClarifyingQuestions({
  sessionId,
  questionSetId,
  fallbackRationale,
  fallbackItems,
}: InlineClarifyingQuestionsProps) {
  const { data: sets } = useQuestionSets(sessionId);
  const set = questionSetId
    ? (sets ?? []).find((s) => s.id === questionSetId)
    : undefined;

  // While the tool input is still streaming we don't have a `set` from the
  // server yet — fall back to whatever input has streamed in so far. This
  // mirrors the inline plan checklist's streaming behavior.
  const fallbackComplete =
    fallbackItems?.every(
      (q) => q && Array.isArray(q.options) && q.options.length >= 2 && q.prompt,
    ) ?? false;

  if (!set && !fallbackComplete) {
    return (
      <div className="my-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-subtle">
        <Loader2 className="size-3 animate-spin" />
        Drafting questions…
      </div>
    );
  }

  // If the server has the set, use it as source of truth (status, items,
  // existing answers). Otherwise fall back to the streamed input — but only
  // for display; we can't submit answers until the set exists in the DB.
  const items: ClarifyingQuestionItem[] =
    set?.questions.items ?? fallbackItems ?? [];
  const rationale = set?.questions.rationale ?? fallbackRationale ?? null;

  return (
    <Card>
      <Header
        rationale={rationale}
        status={set?.status ?? "OPEN"}
      />
      {set ? (
        <QuestionSetBody
          sessionId={sessionId}
          set={set}
        />
      ) : (
        <ReadOnlyBody items={items} />
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 rounded-2xl border border-border bg-surface p-3.5">
      {children}
    </div>
  );
}

function Header({
  rationale,
  status,
}: {
  rationale: string | null;
  status: ClarifyingQuestionSetDTO["status"];
}) {
  const meta = match(status)
    .with("OPEN", () => null)
    .with("ANSWERED", () => ({
      label: "Answered",
      cls: "bg-success/15 text-success",
    }))
    .with("DISMISSED", () => ({
      label: "Skipped",
      cls: "bg-surface-sunken text-ink-muted",
    }))
    .exhaustive();

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <HelpCircle className="size-3.5 shrink-0 text-ink-muted" />
        <span className="truncate text-xs font-medium text-ink">
          A few quick questions
        </span>
      </div>
      {meta ? (
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}
        >
          {meta.label}
        </span>
      ) : null}
      {rationale && status === "OPEN" ? (
        <span className="sr-only">{rationale}</span>
      ) : null}
    </div>
  );
}

function QuestionSetBody({
  sessionId,
  set,
}: {
  sessionId: string;
  set: ClarifyingQuestionSetDTO;
}) {
  const items = set.questions.items;
  const queryClient = useQueryClient();
  const enqueueChatMessage = useWorkspaceStore((s) => s.enqueueChatMessage);

  // Default each question to its recommended option (or first option if none),
  // unless the set has already been answered — then mirror the saved answers.
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>(() => {
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
// exist yet — there's no set id to submit against, so the controls are
// disabled placeholders. As soon as the input finishes streaming and the
// tool's `execute` resolves, the parent re-renders with `set` populated and
// `QuestionSetBody` takes over.
function ReadOnlyBody({ items }: { items: ClarifyingQuestionItem[] }) {
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
