export const ZERO_USAGE = {
  currentInputTokens: 0,
  lifetimeFoldedTokens: 0,
  lifetimeOutputTokens: 0,
  summarizedCount: 0,
  totalCostUsd: 0,
} as const;

export const numberFormatter = new Intl.NumberFormat("en-US");

/**
 * Cost is small per turn (often fractions of a cent), so we render with up to
 * 4 fractional digits when it's under $1 and 2 above that. Prevents "$0.00"
 * for a turn that actually cost $0.0023.
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
