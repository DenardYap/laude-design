import { HelpCircle } from "lucide-react";
import { match } from "ts-pattern";

import type { QuestionHeaderProps } from "@/components/workspace/chat/types/questions";

export function QuestionHeader({ rationale, status }: QuestionHeaderProps) {
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
