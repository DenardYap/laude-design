"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { lastFour } from "@/lib/api-keys/last-four";
import type { AiProvider } from "@/lib/validators";

type KeysMap = Partial<Record<AiProvider, string>>;

interface ApiKeysState {
  keys: KeysMap;

  /** Save (or replace) an API key for a provider. */
  setKey: (provider: AiProvider, secret: string) => void;

  /** Remove the stored key for a provider. */
  clearKey: (provider: AiProvider) => void;

  /**
   * Returns the masked last-four suffix for display, or null when no key is
   * stored for the provider.
   */
  getMasked: (provider: AiProvider) => { lastFour: string } | null;
}

export const useApiKeysStore = create<ApiKeysState>()(
  persist(
    (set, get) => ({
      keys: {},

      setKey: (provider, secret) =>
        set((s) => ({ keys: { ...s.keys, [provider]: secret } })),

      clearKey: (provider) =>
        set((s) => {
          const next = { ...s.keys };
          delete next[provider];
          return { keys: next };
        }),

      getMasked: (provider) => {
        const secret = get().keys[provider];
        if (!secret) return null;
        return { lastFour: lastFour(secret) };
      },
    }),
    {
      name: "laude.apiKeys.v1",
    },
  ),
);

/** Returns the set of providers that have a non-empty key stored. */
export function useConfiguredProviders(): Set<AiProvider> {
  const keys = useApiKeysStore((s) => s.keys);
  return new Set(
    (Object.keys(keys) as AiProvider[]).filter((p) => !!keys[p]),
  );
}

/** Returns the raw key for a given provider, or undefined if not configured. */
export function useApiKey(provider: AiProvider): string | undefined {
  return useApiKeysStore((s) => s.keys[provider]);
}
