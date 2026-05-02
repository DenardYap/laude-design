"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { match } from "ts-pattern";

import { Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type {
  AnswerValue,
  ClarifyingQuestionItem,
  ClarifyingQuestionSetDTO,
} from "@/app/api/sessions/[sessionId]/questions/route";

async function fetchSets(sessionId: string): Promise<ClarifyingQuestionSetDTO[]> {
  const res = await fetch(`/api/sessions/${sessionId}/questions`);
  if (!res.ok) throw new Error("Failed to load questions");
  const data = (await res.json()) as { sets: ClarifyingQuestionSetDTO[] };
  return data.sets;
}

export function useQuestionSets(sessionId: string) {
  // New clarifying-question sets are only ever created during an agent turn
  // (via a tool call). Once streaming ends, nothing new can appear until the
  // next user message, so polling in that window is pure waste. Mutations
  // (answer / dismiss) already invalidate this key directly.
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

interface QuestionBlockProps {
  question: ClarifyingQuestionItem;
  value: AnswerValue | undefined;
  disabled?: boolean;
  onChange: (v: AnswerValue) => void;
}

export function QuestionBlock({
  question,
  value,
  disabled,
  onChange,
}: QuestionBlockProps) {
  const isFreeText = value?.kind === "text";

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium text-ink">{question.prompt}</p>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {question.options.map((opt, idx) => {
          const selected =
            value?.kind === "option" && value.optionId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ kind: "option", optionId: opt.id })}
              className={cn(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors",
                idx > 0 && "border-t border-border",
                selected
                  ? "bg-brand-soft text-ink"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                disabled && "cursor-default hover:bg-transparent hover:text-ink-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-ink-subtle/50",
                )}
              >
                {selected ? <Check className="size-2.5" /> : null}
              </span>
              <span className="flex-1 text-ink">{opt.label}</span>
              {opt.recommended ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  Recommended
                </span>
              ) : null}
            </button>
          );
        })}
        {question.allowFreeText ? (
          <div
            className={cn(
              "border-t border-border px-2 py-1.5 transition-colors",
              isFreeText ? "bg-brand-soft/40" : "bg-surface",
            )}
          >
            <Textarea
              placeholder="Or type your own answer…"
              rows={2}
              disabled={disabled}
              value={isFreeText ? value.text : ""}
              onChange={(e) =>
                onChange({ kind: "text", text: e.target.value })
              }
              onFocus={() => {
                if (!isFreeText && !disabled) onChange({ kind: "text", text: "" });
              }}
              className="min-h-[44px] resize-none border-0 bg-transparent px-1.5 py-0.5 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function allAnswered(
  items: ClarifyingQuestionItem[],
  answers: Record<string, AnswerValue>,
) {
  return items.every((q) => {
    const a = answers[q.id];
    if (!a) return false;
    return match(a)
      .with({ kind: "option" }, ({ optionId }) =>
        q.options.some((o) => o.id === optionId),
      )
      .with({ kind: "options" }, ({ optionIds }) => optionIds.length > 0)
      .with({ kind: "text" }, ({ text }) => text.trim().length > 0)
      .exhaustive();
  });
}

export function synthesizeAnswerMessage(
  items: ClarifyingQuestionItem[],
  answers: Record<string, AnswerValue>,
) {
  const lines = items.map((q) => {
    const a = answers[q.id];
    const rendered = a
      ? match(a)
          .with({ kind: "option" }, ({ optionId }) => {
            const opt = q.options.find((o) => o.id === optionId);
            return opt?.label ?? optionId;
          })
          .with({ kind: "options" }, ({ optionIds }) =>
            optionIds
              .map(
                (id) => q.options.find((o) => o.id === id)?.label ?? id,
              )
              .join(", "),
          )
          .with({ kind: "text" }, ({ text }) => text.trim())
          .exhaustive()
      : "—";
    return `- ${q.prompt} → ${rendered}`;
  });
  return `Here are my answers:\n${lines.join("\n")}`;
}

export function synthesizeSkipMessage(items: ClarifyingQuestionItem[]) {
  const skipped = items.map((q) => `- ${q.prompt}`).join("\n");
  return [
    "I'd rather skip these questions:",
    skipped,
    "",
    "Use your best judgment based on what I've already told you. If you genuinely can't move forward without one of them, push back briefly and explain why; otherwise just proceed with the design.",
  ].join("\n");
}
