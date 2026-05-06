import { ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ApiKeysList } from "@/components/api-keys/api-keys-list";
import type { ProviderConfig } from "@/components/api-keys/types/api-keys";
import type { AiProvider } from "@/lib/validators";
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

export default async function ApiKeysPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Cheap server-side cleanup before fetch: delete any of THIS user's rows
  // that have aged out. Mirrors the same sweep `/api/api-keys` does so the
  // page never momentarily shows a key the chat route would reject.
  if (userId) {
    await db.apiKey.deleteMany({
      where: { userId, expiresAt: { lte: new Date() } },
    });
  }

  // Pull only the public-facing fields. Ciphertext is intentionally excluded
  // from this query — there is no scenario where the page itself needs it.
  const rows = userId
    ? await db.apiKey.findMany({
        where: { userId },
        select: { provider: true, lastFour: true, expiresAt: true },
      })
    : [];

  const existingByProvider = new Map<
    AiProvider,
    { lastFour: string; expiresAt: string | null }
  >(
    rows.map((r) => [
      r.provider as AiProvider,
      {
        lastFour: r.lastFour,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      },
    ]),
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Configure API"
        description="Bring your own keys for the LLMs you want to use."
      />
      <ApiKeysList providers={PROVIDERS} existingByProvider={existingByProvider} />
    </div>
  );
}
