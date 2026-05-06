import { match } from "ts-pattern";

import type { ChatSessionDTO } from "@/lib/workspace/types";
import type { RecencyGroup } from "@/components/workspace/chat/types/session";

/** Encodes a session id into a cmdk-safe value that stays unique per item. */
export function itemValue(sessionId: string): string {
  return `session:${sessionId}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Groups sessions by `updatedAt` into human-readable recency buckets.
 * Calendar-day boundaries for "Today"/"Yesterday"; older buckets use
 * elapsed-time so a 5-day-old session reads as "5 days ago" regardless of
 * the time of day.
 */
export function groupByRecency(sessions: ChatSessionDTO[]): RecencyGroup[] {
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - DAY_MS;

  const buckets: Record<string, ChatSessionDTO[]> = {};
  const order: string[] = [];

  for (const session of sorted) {
    const t = new Date(session.updatedAt).getTime();
    const label = bucketLabel(t, startOfToday, startOfYesterday);
    if (!buckets[label]) {
      buckets[label] = [];
      order.push(label);
    }
    buckets[label].push(session);
  }

  return order.map((label) => ({ label, sessions: buckets[label]! }));
}

export function bucketLabel(
  t: number,
  startOfToday: number,
  startOfYesterday: number,
): string {
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";

  const days = Math.ceil((startOfToday - t) / DAY_MS);

  return match(days)
    .when((d) => d < 7, (d) => `${d} days ago`)
    .when((d) => d < 14, () => "1 week ago")
    .when((d) => d < 30, (d) => `${Math.floor(d / 7)} weeks ago`)
    .when((d) => d < 60, () => "1 month ago")
    .when((d) => d < 365, (d) => `${Math.floor(d / 30)} months ago`)
    .when((d) => d < 730, () => "1 year ago")
    .otherwise((d) => `${Math.floor(d / 365)} years ago`);
}

/** Re-export internals for unit tests. */
export const __testing = { groupByRecency, bucketLabel };
