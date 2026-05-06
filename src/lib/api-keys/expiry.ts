import { DAY_MS, type ApiKeyLifetime } from "@/lib/validators";

export const LIFETIME_OPTIONS: ReadonlyArray<{
  value: ApiKeyLifetime;
  label: string;
}> = [
  { value: "never", label: "Never" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
];

/**
 * Returns a short human-readable description of how soon a saved key will
 * expire (e.g. "Expires in 6 days", "Expires today", "Expired"). Returns
 * `null` when the key has no auto-expiry. Designed for inline display in
 * row headers — keep it terse.
 */
export function formatExpiry(expiresAtIso: string | null): string | null {
  if (!expiresAtIso) return null;
  const expiresAt = new Date(expiresAtIso);
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const days = Math.ceil(diffMs / DAY_MS);
  if (days <= 1) return "Expires today";
  return `Expires in ${days} days`;
}
