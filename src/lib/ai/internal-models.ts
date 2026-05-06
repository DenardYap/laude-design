// SECURITY: Never log the activeApiKey argument.
import { match } from "ts-pattern";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AiProvider } from "@/lib/validators";

import type { InternalModel } from "./types/internal-models";

export type { InternalModel };

// "Internal" models are the small/cheap models we use for non-user-facing work
// like session titling and rolling-summary generation. We never expose these
// in the picker — they're chosen automatically based on the active provider key
// sent with the request.

const INTERNAL_MODELS: Record<AiProvider, string> = {
  CLAUDE: "claude-haiku-4-5",
  GEMINI: "gemini-2.5-flash-lite",
  OPENAI: "gpt-5.4-mini",
};

// Preference order: Anthropic first (Haiku is the cheapest of the three for
// short tasks), then Gemini Flash-Lite, then GPT-5.4 mini.
const PROVIDER_PREFERENCE: readonly AiProvider[] = [
  "CLAUDE",
  "GEMINI",
  "OPENAI",
] as const;

/**
 * Resolves a small/cheap model for internal background tasks (titles,
 * summarization) using the active provider's key sent with the request.
 * Returns null if the active provider is not in the preference list or the key
 * is empty — callers treat this as "skip the background task".
 */
export function resolveInternalModel({
  activeProvider,
  activeApiKey,
}: {
  activeProvider: AiProvider;
  activeApiKey: string;
}): InternalModel | null {
  if (!activeApiKey) return null;
  if (!PROVIDER_PREFERENCE.includes(activeProvider)) return null;

  const modelId = INTERNAL_MODELS[activeProvider];
  const model = match(activeProvider)
    .with("CLAUDE", () => createAnthropic({ apiKey: activeApiKey })(modelId))
    .with("OPENAI", () => createOpenAI({ apiKey: activeApiKey })(modelId))
    .with("GEMINI", () =>
      createGoogleGenerativeAI({ apiKey: activeApiKey })(modelId),
    )
    .exhaustive();

  return { provider: activeProvider, modelId, model };
}
