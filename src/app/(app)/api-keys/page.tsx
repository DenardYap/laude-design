import { ShieldAlert } from "lucide-react";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ApiKeysList } from "@/components/api-keys/api-keys-list";
import type { ProviderConfig } from "@/components/api-keys/api-key-row";
import { AnthropicIcon, GoogleIcon, OpenAIIcon } from "@/components/api-keys/provider-icons";
import type { AiProvider } from "@/lib/validators";

export const metadata = { title: "Configure API · Laude Design" };

const PROVIDERS: ProviderConfig[] = [
  {
    provider: "CLAUDE",
    name: "Anthropic",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    dashboardLabel: "Anthropic Console",
    icon: <AnthropicIcon />,
  },
  {
    provider: "GEMINI",
    name: "Google",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    dashboardLabel: "Google AI Studio",
    icon: <GoogleIcon />,
  },
  {
    provider: "OPENAI",
    name: "OpenAI",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    dashboardLabel: "OpenAI Platform",
    icon: <OpenAIIcon />,
  },
];

export default async function ApiKeysPage() {
  const user = await requireUser();
  const existingKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: { provider: true, lastFour: true, updatedAt: true },
  });

  const existingByProvider = existingKeys.reduce(
    (acc, k) => {
      acc[k.provider as AiProvider] = {
        lastFour: k.lastFour,
        updatedAt: k.updatedAt,
      };
      return acc;
    },
    {} as Record<AiProvider, { lastFour: string; updatedAt: Date } | undefined>,
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Configure API"
        description="Bring your own keys for the LLMs you want to use. Keys are encrypted at rest."
      />
      <p className="flex items-start gap-1.5 text-xs text-ink-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <span>
          Use a dedicated key per provider — never reuse a production key. Keys are encrypted at
          rest with AES-256-GCM and never shown in full.
        </span>
      </p>
      <ApiKeysList providers={PROVIDERS} existingByProvider={existingByProvider} />
    </div>
  );
}
