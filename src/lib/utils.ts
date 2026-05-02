import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 45) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length === 1) return source.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Rough character → token estimate using the 4 chars ≈ 1 token heuristic.
// Good enough for surface-level UI hints; real tokenization varies by model.
export function estimateTokens(chars: number): number {
  return Math.round(Math.max(0, chars) / 4);
}

export function formatSkillSize(chars: number): string {
  const safeChars = Math.max(0, chars);
  const tokens = estimateTokens(safeChars);
  return `${safeChars.toLocaleString("en-US")} chars, ~${tokens.toLocaleString("en-US")} tokens`;
}
