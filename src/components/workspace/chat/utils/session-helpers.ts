import {
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

/**
 * Custom continuation predicate for useChat's `sendAutomaticallyWhen`.
 * Behaves identically to `lastAssistantMessageIsCompleteWithToolCalls` EXCEPT
 * when the last assistant turn called `askClarifyingQuestions`. That tool
 * pauses the agentic loop deliberately — the user must answer the inline card
 * before the agent proceeds. Allowing auto-continuation here would immediately
 * send the tool result back, causing the model to call `askClarifyingQuestions`
 * again and render a duplicate question card.
 */
export function sendAutomaticallyWhen({ messages }: { messages: UIMessage[] }): boolean {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (lastAssistant) {
    const calledAskQuestions = lastAssistant.parts.some(
      (p) => p.type === "tool-askClarifyingQuestions",
    );
    if (calledAskQuestions) return false;
  }
  return lastAssistantMessageIsCompleteWithToolCalls({ messages });
}
