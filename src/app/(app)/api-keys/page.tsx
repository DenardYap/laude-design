import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { ApiKeyWarningBanner } from "@/components/api-keys/api-key-warning-banner";
import { ApiKeyRow, type ProviderConfig } from "@/components/api-keys/api-key-row";

export const metadata = { title: "Configure API · Laude Design" };

const PROVIDERS: ProviderConfig[] = [
  {
    provider: "CLAUDE",
    name: "Laude",
    description: "Anthropic Laude (3.5/3.7/4.x).",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    accent: "bg-primary text-primary-foreground",
  },
  {
    provider: "GEMINI",
    name: "Gemini",
    description: "Google Gemini API key.",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    accent: "bg-accent text-accent-foreground",
  },
  {
    provider: "OPENAI",
    name: "OpenAI",
    description: "GPT-4o / GPT-4.1 / o-series.",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    accent: "bg-success/15 text-success",
  },
];

export default async function ApiKeysPage() {
  const user = await requireUser();
  const existingKeys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: { provider: true, lastFour: true, label: true, updatedAt: true },
  });
  const byProvider = new Map(existingKeys.map((k) => [k.provider, k]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configure API"
        description="Bring your own keys for the LLMs you want to use in design mode. Keys are encrypted at rest."
      />
      <ApiKeyWarningBanner />
      <div className="space-y-3">
        {PROVIDERS.map((config) => (
          <ApiKeyRow
            key={config.provider}
            config={config}
            existing={byProvider.get(config.provider) ?? undefined}
          />
        ))}
      </div>
    </div>
  );
}
