import type { SystemModelMessage, Tool } from "ai";

/**
 * Helpers for opting into provider-specific prompt caching.
 *
 * Anthropic requires explicit `cache_control` markers on the prompt blocks
 * you want cached (system, tool definitions, message parts), with a max of
 * 4 breakpoints per request. Each marker says "cache everything in the
 * prompt up to and including this block". On subsequent turns the provider
 * looks up the cached prefix and bills cache reads at ~10% of the base
 * input rate (Anthropic) instead of the full rate.
 *
 * OpenAI and Gemini also support prompt caching but do it automatically:
 * GPT-4o+ caches any prefix ≥1024 tokens, and Gemini 2.5+ implicitly
 * caches whatever prefix it can. Neither requires us to attach markers,
 * so the helpers below only add `providerOptions.anthropic.*` — fields
 * the other providers safely ignore.
 *
 * Strategy in this app:
 *  1. Split the system prompt into a STABLE block (system text + skills +
 *     critique addendum) and a VOLATILE block (rolling summary). Mark the
 *     stable block as cacheable; leave the summary uncached because
 *     summarization edits its bytes and would invalidate the prefix.
 *  2. Mark the LAST tool definition as cacheable. Anthropic treats this
 *     as a single breakpoint that caches every preceding block —
 *     including the stable system block above and every other tool.
 *
 * That gives us two breakpoints per request (well under the 4-cap) and
 * pulls system + tools (~18k tokens) into the cache for roughly a 90%
 * input-cost discount on every turn after the first one inside a 5-min
 * cache TTL window.
 */

// Provider-options shape understood by `@ai-sdk/anthropic`. Other
// providers receive this metadata and ignore it (providerOptions are
// namespaced by provider name).
const ANTHROPIC_EPHEMERAL_CACHE = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

/**
 * Return a copy of the tools object where the last tool has an Anthropic
 * `cache_control: ephemeral` marker attached. JS object iteration is
 * insertion-ordered, so "last" matches the order Anthropic will receive.
 *
 * Caching the LAST tool implicitly caches every preceding tool plus the
 * system prompt block above it.
 */
export function withCachedToolPrefix<T extends Record<string, Tool>>(
  tools: T,
): T {
  const entries = Object.entries(tools);
  if (entries.length === 0) return tools;
  const lastIndex = entries.length - 1;
  const [lastKey, lastTool] = entries[lastIndex];
  const patched = {
    ...lastTool,
    providerOptions: {
      ...lastTool.providerOptions,
      ...ANTHROPIC_EPHEMERAL_CACHE,
    },
  };
  return { ...tools, [lastKey]: patched } as T;
}

/**
 * Build the `system` argument for `streamText` such that the stable prefix
 * (system text + addendums) is cacheable while the volatile rolling summary
 * sits in its own un-marked block. Returns an array of `SystemModelMessage`
 * because that's the only shape that lets us attach per-block
 * `providerOptions` (the `system: string` shorthand has no metadata slot).
 *
 * On Anthropic this produces two system blocks; the first is cached.
 * On OpenAI / Gemini the providerOptions are ignored and the messages
 * are concatenated into a normal system prompt — no behavior change.
 */
export function buildCacheableSystemPrompt({
  stable,
  summary,
}: {
  stable: string;
  summary: string | null;
}): SystemModelMessage[] {
  const messages: SystemModelMessage[] = [
    {
      role: "system",
      content: stable,
      providerOptions: ANTHROPIC_EPHEMERAL_CACHE,
    },
  ];
  if (summary) {
    messages.push({
      role: "system",
      content: `## Earlier conversation summary\n${summary}`,
      // Deliberately no cacheControl — the summary's bytes change every
      // time `applyRollingSummary` fires, so caching it would invalidate
      // the rest of the prefix on every summarization event.
    });
  }
  return messages;
}
