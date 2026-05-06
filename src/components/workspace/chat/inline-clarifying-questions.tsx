"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useQuestionSets } from "@/components/workspace/chat/hooks/use-question-sets";
import { QuestionCard } from "@/components/workspace/chat/question-card";
import { QuestionHeader } from "@/components/workspace/chat/question-header";
import { QuestionSetBody } from "@/components/workspace/chat/question-set-body";
import { ReadOnlyBody } from "@/components/workspace/chat/read-only-body";
import type { InlineClarifyingQuestionsProps } from "@/components/workspace/chat/types/questions";

// ---------------------------------------------------------------------------
// InlineClarifyingQuestions — public API
// ---------------------------------------------------------------------------

export function InlineClarifyingQuestions({
  sessionId,
  state,
  questionSetId,
  fallbackRationale,
  fallbackItems,
}: InlineClarifyingQuestionsProps) {
  const { data: sets, refetch } = useQuestionSets(sessionId);
  const set = questionSetId
    ? (sets ?? []).find((s) => s.id === questionSetId)
    : undefined;

  // If the tool output has given us a questionSetId but the set hasn't
  // appeared in the cache yet (streaming ended before the last poll ran),
  // keep refetching until the row shows up.
  useEffect(() => {
    if (!questionSetId || set) return;
    const id = setInterval(() => void refetch(), 800);
    return () => clearInterval(id);
  }, [questionSetId, set, refetch]);

  const isInputStreaming = state === "input-streaming";
  const items = set?.questions.items ?? fallbackItems ?? [];

  if (!set && (isInputStreaming || items.length === 0)) {
    return (
      <div className="my-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-subtle">
        <Loader2 className="size-3 animate-spin" />
        Drafting questions…
      </div>
    );
  }

  const rationale = set?.questions.rationale ?? fallbackRationale ?? null;

  return (
    <QuestionCard>
      <QuestionHeader rationale={rationale} status={set?.status ?? "OPEN"} />
      {set ? (
        <QuestionSetBody sessionId={sessionId} set={set} />
      ) : (
        <ReadOnlyBody items={items} />
      )}
    </QuestionCard>
  );
}
