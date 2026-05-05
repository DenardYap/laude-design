// SECURITY: Never log the apiKey argument. Errors are sanitized before
// reaching the client — see errorMessageForClient in the chat route.
import { match } from "ts-pattern";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { AiProvider } from "@/lib/validators";

export class MissingApiKeyError extends Error {
  constructor(public provider: AiProvider) {
    super(`No API key configured for ${provider}`);
    this.name = "MissingApiKeyError";
  }
}

export function resolveModel(
  provider: AiProvider,
  modelId: string,
  apiKey: string,
): LanguageModel {
  if (!apiKey?.trim()) throw new MissingApiKeyError(provider);

  return match(provider)
    .with("CLAUDE", () => createAnthropic({ apiKey })(modelId))
    .with("OPENAI", () => createOpenAI({ apiKey })(modelId))
    .with("GEMINI", () => createGoogleGenerativeAI({ apiKey })(modelId))
    .exhaustive();
}
