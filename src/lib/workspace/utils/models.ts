import type { ModelOption, ModelProvider } from "../types";

export type { ModelOption, ModelProvider };

export const MODEL_OPTIONS: ModelOption[] = [
  // ------- Anthropic / Claude -------
  {
    provider: "CLAUDE",
    modelId: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Best for design — balanced & capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "CLAUDE",
    modelId: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    description: "Most capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "CLAUDE",
    modelId: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Fast & cheap",
    contextWindow: 200_000,
  },

  // ------- OpenAI -------
  {
    provider: "OPENAI",
    modelId: "gpt-5.5",
    label: "GPT-5.5",
    description: "Most capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "OPENAI",
    modelId: "gpt-5.4",
    label: "GPT-5.4",
    description: "Smart & fast",
    contextWindow: 1_000_000,
  },
  {
    provider: "OPENAI",
    modelId: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description: "Fastest & cheapest",
    contextWindow: 400_000,
  },

  // ------- Google / Gemini -------
  {
    provider: "GEMINI",
    modelId: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    description: "Most capable",
    contextWindow: 1_000_000,
  },
  {
    provider: "GEMINI",
    modelId: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    description: "Fast",
    contextWindow: 1_000_000,
  },
  {
    provider: "GEMINI",
    modelId: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite",
    description: "Cheapest",
    contextWindow: 1_000_000,
  },
];

const FALLBACK_CONTEXT_WINDOW = 128_000;

export function getContextWindow(provider: ModelProvider, modelId: string): number {
  const match = MODEL_OPTIONS.find(
    (m) => m.provider === provider && m.modelId === modelId,
  );
  return match?.contextWindow ?? FALLBACK_CONTEXT_WINDOW;
}

export function resolveModelOption(
  selected: { provider: string; modelId: string } | undefined,
): ModelOption {
  if (!selected) return MODEL_OPTIONS[0];
  return (
    MODEL_OPTIONS.find(
      (m) => m.provider === selected.provider && m.modelId === selected.modelId,
    ) ?? MODEL_OPTIONS[0]
  );
}

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  CLAUDE: "Anthropic",
  OPENAI: "OpenAI",
  GEMINI: "Google",
};

export const PROVIDER_ORDER: readonly ModelProvider[] = ["CLAUDE", "OPENAI", "GEMINI"] as const;
