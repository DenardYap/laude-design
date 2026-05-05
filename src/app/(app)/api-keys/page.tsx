import { ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/ui";
import { ApiKeysList } from "@/components/api-keys/api-keys-list";
import { MigrationBanner } from "@/components/api-keys/migration-banner";
import type { ProviderConfig } from "@/components/api-keys/types/api-keys";
import { AnthropicIcon } from "@/components/api-keys/anthropic-icon";
import { GoogleIcon } from "@/components/api-keys/google-icon";
import { OpenAIIcon } from "@/components/api-keys/openai-icon";

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

export default function ApiKeysPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Configure API"
        description="Bring your own keys for the LLMs you want to use."
      />
      <p className="flex items-start gap-1.5 text-xs text-ink-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
        <span>
          Keys are stored in this browser and sent to our server only when processing your AI
          requests — we never write them to our database.{" "}
          <strong>Use a dedicated key per provider</strong> and revoke it on the provider&apos;s
          dashboard if it may be compromised.
        </span>
      </p>
      <ApiKeysList providers={PROVIDERS} />
    </div>
  );
}
