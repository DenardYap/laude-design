import { match } from "ts-pattern";

import type {
  AnswerValue,
  ClarifyingQuestionItem,
} from "@/app/api/sessions/[sessionId]/questions/route";

export function allAnswered(
  items: ClarifyingQuestionItem[],
  answers: Record<string, AnswerValue>,
): boolean {
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
): string {
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
              .map((id) => q.options.find((o) => o.id === id)?.label ?? id)
              .join(", "),
          )
          .with({ kind: "text" }, ({ text }) => text.trim())
          .exhaustive()
      : "—";
    return `- ${q.prompt} → ${rendered}`;
  });
  return `Here are my answers:\n${lines.join("\n")}`;
}

export function synthesizeSkipMessage(items: ClarifyingQuestionItem[]): string {
  const skipped = items.map((q) => `- ${q.prompt}`).join("\n");
  return [
    "I'd rather skip these questions:",
    skipped,
    "",
    "Use your best judgment based on what I've already told you. If you genuinely can't move forward without one of them, push back briefly and explain why; otherwise just proceed with the design.",
  ].join("\n");
}
