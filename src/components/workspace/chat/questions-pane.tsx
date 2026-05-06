"use client";

import { Check } from "lucide-react";

import { Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuestionBlockProps } from "@/components/workspace/chat/types/questions";
import {
  allAnswered,
  synthesizeAnswerMessage,
  synthesizeSkipMessage,
} from "@/components/workspace/chat/utils/clarifying-questions";

export { allAnswered, synthesizeAnswerMessage, synthesizeSkipMessage };

export { useQuestionSets } from "@/components/workspace/chat/hooks/use-question-sets";


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