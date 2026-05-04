"use client";

import { useEffect } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { match } from "ts-pattern";

import type { ClarifyingQuestionSetDTO } from "@/app/api/sessions/[sessionId]/questions/route";
import { useQuestionSets } from "@/components/workspace/chat/hooks/use-question-sets";
import {
  QuestionSetBody,
  ReadOnlyBody,
} from "@/components/workspace/chat/question-set-body";
import type { InlineClarifyingQuestionsProps } from "@/components/workspace/chat/types/questions";

// ---------------------------------------------------------------------------
// QuestionCard — surface container
// ---------------------------------------------------------------------------

function QuestionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 rounded-2xl border border-border bg-surface p-3.5">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestionHeader — title row with optional status badge
// ---------------------------------------------------------------------------

function QuestionHeader({
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

  // The single source of truth for "are we still drafting?" is the AI SDK
  // tool-part state. While `state === "input-streaming"`, the partial input
  // walks through shapes like `[] → [{}] → [{partial}] → [{complete},
  // {partial}]`, so trying to derive "is it ready yet?" from the input shape
  // makes the loader flicker. Once the part transitions past streaming (or we
  // already have the persisted `set`), we commit — and never flip back.
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
