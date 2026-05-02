import { match } from "ts-pattern";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { AiProvider } from "@prisma/client";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export class MissingApiKeyError extends Error {
  constructor(public provider: AiProvider) {
    super(`No API key configured for ${provider}`);
    this.name = "MissingApiKeyError";
  }
}

export async function resolveModel(
  userId: string,
  provider: AiProvider,
  modelId: string,
): Promise<LanguageModel> {
  const apiKey = await db.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { ciphertext: true },
  });
  if (!apiKey) throw new MissingApiKeyError(provider);
  const secret = decryptSecret(apiKey.ciphertext);

  return match(provider)
    .with("CLAUDE", () => createAnthropic({ apiKey: secret })(modelId))
    .with("OPENAI", () => createOpenAI({ apiKey: secret })(modelId))
    .with("GEMINI", () => createGoogleGenerativeAI({ apiKey: secret })(modelId))
    .exhaustive();
}
