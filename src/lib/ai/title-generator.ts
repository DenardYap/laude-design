import { generateText, type ModelMessage } from "ai";
import type { AiProvider } from "@/lib/validators";

import { resolveInternalModel } from "@/lib/ai/internal-models";

const TITLE_SYSTEM_PROMPT = `You generate concise titles for design chat conversations.

Rules:
- Output ONLY the title — no quotes, no punctuation, no preamble, no trailing period.
- 3 to 5 words.
- Title Case (capitalize principal words).
- Capture the user's design intent, not generic chat metadata.

Examples:
Landing Page Hero Redesign
Mobile Onboarding Flow
Pricing Table Layout
Settings Dark Mode Toggle`;

const MAX_USER_CHARS = 800;
const MAX_ASSISTANT_CHARS = 400;
const MAX_TITLE_LEN = 60;

/**
 * Returns a 3–5 word title summarizing a conversation, or `null` if the
 * active provider key is absent or the generation fails. Errors are swallowed
 * so a failed title never blocks the chat response.
 */
export async function generateSessionTitle({
  activeProvider,
  activeApiKey,
  firstUserMessage,
  firstAssistantMessage,
}: {
  activeProvider: AiProvider;
  activeApiKey: string;
  firstUserMessage: string;
  firstAssistantMessage: string;
}): Promise<string | null> {
  const internal = resolveInternalModel({ activeProvider, activeApiKey });
  if (!internal) return null;

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        `User: ${firstUserMessage.slice(0, MAX_USER_CHARS)}`,
        firstAssistantMessage
          ? `Assistant: ${firstAssistantMessage.slice(0, MAX_ASSISTANT_CHARS)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  try {
    const result = await generateText({
      model: internal.model,
      system: TITLE_SYSTEM_PROMPT,
      messages,
      maxOutputTokens: 30,
      temperature: 0.3,
    });
    const cleaned = result.text
      .trim()
      .replace(/^["'`]+|["'`.\s]+$/g, "")
      .slice(0, MAX_TITLE_LEN);
    return cleaned || null;
  } catch (err) {
    console.error("[title-generator]", err);
    return null;
  }
}
