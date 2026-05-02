"use client";

import * as React from "react";
import { Check, MessageSquare } from "lucide-react";
import { match } from "ts-pattern";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui";
import type { ChatSessionDTO } from "@/lib/workspace/types";

interface SessionHistoryListProps {
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
  onSelect: (sessionId: string) => void;
}

// Bucket boundaries are computed once per render against `now`. We pre-bucket
// the sessions so `cmdk` only filters by title — cmdk is the source of truth
// for search; we only re-group within each search result by recency.
export function SessionHistoryList({
  sessions,
  activeSessionId,
  onSelect,
}: SessionHistoryListProps) {
  const groups = React.useMemo(() => groupByRecency(sessions), [sessions]);

  // Map every cmdk `value` (which must be unique per item) back to the title
  // we want to match against. cmdk dedupes items by value, so we encode the
  // session id into the value to keep them distinct, and use this map to
  // filter on the title only.
  const titleByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const s of group.sessions) {
        map.set(itemValue(s.id), s.title.toLowerCase());
      }
    }
    return map;
  }, [groups]);

  return (
    <Command
      filter={(value, search) => {
        if (!search) return 1;
        const title = titleByValue.get(value) ?? "";
        return title.includes(search.toLowerCase()) ? 1 : 0;
      }}
    >
      <CommandInput placeholder="Search sessions..." />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No sessions match.</CommandEmpty>
        {groups.map((group) =>
          group.sessions.length === 0 ? null : (
            <CommandGroup key={group.label} heading={group.label}>
              {group.sessions.map((s) => (
                <CommandItem
                  key={s.id}
                  value={itemValue(s.id)}
                  onSelect={() => onSelect(s.id)}
                  className="gap-2"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-ink-subtle" />
                  <span className="flex-1 truncate">{s.title}</span>
                  {s.id === activeSessionId ? (
                    <Check className="size-3.5 shrink-0 text-ink-muted" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ),
        )}
      </CommandList>
    </Command>
  );
}

// Prefix keeps the cmdk value distinct from any other Command consumer that
// might share the DOM (defensive — currently this list lives in its own popover).
function itemValue(sessionId: string): string {
  return `session:${sessionId}`;
}

interface RecencyGroup {
  // Stable key used to render and to disambiguate cmdk values across groups.
  label: string;
  sessions: ChatSessionDTO[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Group sessions by `updatedAt` against fixed buckets. We use calendar-day
// boundaries for "Today" and "Yesterday" so the labels match user intuition;
// older buckets fall back to elapsed-time so a 5-day-old session reads as
// "5 days ago" regardless of the time of day it was last touched.
function groupByRecency(sessions: ChatSessionDTO[]): RecencyGroup[] {
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
    const label = bucketLabel(t, startOfToday, startOfYesterday, now.getTime());
    if (!buckets[label]) {
      buckets[label] = [];
      order.push(label);
    }
    buckets[label].push(session);
  }

  return order.map((label) => ({ label, sessions: buckets[label]! }));
}

function bucketLabel(
  t: number,
  startOfToday: number,
  startOfYesterday: number,
  nowMs: number,
): string {
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";

  const elapsed = nowMs - t;
  const days = Math.floor(elapsed / DAY_MS);

  return match(days)
    .when(
      (d) => d < 7,
      (d) => `${d} days ago`,
    )
    .when(
      (d) => d < 14,
      () => "1 week ago",
    )
    .when(
      (d) => d < 30,
      (d) => `${Math.floor(d / 7)} weeks ago`,
    )
    .when(
      (d) => d < 60,
      () => "1 month ago",
    )
    .when(
      (d) => d < 365,
      (d) => `${Math.floor(d / 30)} months ago`,
    )
    .when(
      (d) => d < 730,
      () => "1 year ago",
    )
    .otherwise((d) => `${Math.floor(d / 365)} years ago`);
}

// Re-export internals for unit tests / consumers that want the same labels.
export const __testing = { groupByRecency, bucketLabel };
