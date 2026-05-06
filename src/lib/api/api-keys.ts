import { useQuery } from "@tanstack/react-query";

import type { AiProvider } from "@/lib/validators";
import type {
  ApiKeysResponse,
  ConfiguredApiKey,
} from "@/app/api/api-keys/route";

export const apiKeyQueryKeys = {
  configured: ["api-keys", "configured"] as const,
};

async function fetchConfiguredApiKeys(): Promise<ApiKeysResponse> {
  const res = await fetch("/api/api-keys", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch API keys");
  return res.json();
}

/**
 * Returns the providers the user has configured along with their masked
 * suffixes, plus pre-computed lookups (`configured`, `lastFourByProvider`)
 * for ergonomic consumption in pickers and indicators.
 */
export function useConfiguredApiKeys() {
  const { data, ...rest } = useQuery({
    queryKey: apiKeyQueryKeys.configured,
    queryFn: fetchConfiguredApiKeys,
    staleTime: 60_000,
  });

  const keys: ConfiguredApiKey[] = data?.keys ?? [];
  const configured = new Set<AiProvider>(keys.map((k) => k.provider));
  const lastFourByProvider = new Map<AiProvider, string>(
    keys.map((k) => [k.provider, k.lastFour]),
  );
  const expiresAtByProvider = new Map<AiProvider, string | null>(
    keys.map((k) => [k.provider, k.expiresAt]),
  );

  return {
    keys,
    configured,
    lastFourByProvider,
    expiresAtByProvider,
    ...rest,
  };
}
