import { match } from "ts-pattern";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { AiProvider } from "@prisma/client";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

// "Internal" models are the small/cheap models we use for non-user-facing work
// like session titling and rolling-summary generation. We never expose these
// in the picker — they're chosen automatically based on which API keys the
// user has configured, with a stable preference order.

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

export interface InternalModel {
  provider: AiProvider;
  modelId: string;
  model: LanguageModel;
}

/**
 * Resolves a small/cheap model for internal background tasks (titles,
 * summarization). Picks the first provider in `PROVIDER_PREFERENCE` that the
 * user has an API key for. Returns `null` if no key is configured for any
 * provider — callers must treat this as "skip the background task" rather
 * than crashing the main flow.
 */
export async function resolveInternalModel(
  userId: string,
): Promise<InternalModel | null> {
  const keys = await db.apiKey.findMany({
    where: { userId },
    select: { provider: true, ciphertext: true },
  });
  if (keys.length === 0) return null;

  for (const provider of PROVIDER_PREFERENCE) {
    const key = keys.find((k) => k.provider === provider);
    if (!key) continue;
    const secret = decryptSecret(key.ciphertext);
    const modelId = INTERNAL_MODELS[provider];
    const model = match(provider)
      .with("CLAUDE", () => createAnthropic({ apiKey: secret })(modelId))
      .with("OPENAI", () => createOpenAI({ apiKey: secret })(modelId))
      .with("GEMINI", () => createGoogleGenerativeAI({ apiKey: secret })(modelId))
      .exhaustive();
    return { provider, modelId, model };
  }

  return null;
}
