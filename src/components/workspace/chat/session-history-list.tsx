"use client";

import { useMemo } from "react";
import { Check, MessageSquare, Trash2 } from "lucide-react";
import { match } from "ts-pattern";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  RecencyGroup,
  SessionHistoryListProps,
  SessionHistoryRowProps,
} from "@/components/workspace/chat/types/session";
import type { ChatSessionDTO } from "@/lib/workspace/types";

// ---------------------------------------------------------------------------
// SessionHistoryRow — single cmdk item with title, active-check, delete
// ---------------------------------------------------------------------------

function SessionHistoryRow({
  session,
  isActive,
  onSelect,
  onDelete,
}: SessionHistoryRowProps) {
  return (
    <CommandItem
      value={itemValue(session.id)}
      onSelect={onSelect}
      className="group gap-2 pr-1"
    >
      <MessageSquare className="size-3.5 shrink-0 text-ink-subtle" />
      {/* Inner flex groups the title with the active-check so the check sits
          flush against the visible end of the name. `min-w-0` on both the
          group and the span is what lets `truncate` produce an ellipsis
          inside a flex child. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate">{session.title}</span>
        {isActive ? (
          <Check className="size-3.5 shrink-0 text-ink-muted" />
        ) : null}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Delete ${session.title}`}
            // cmdk uses pointerdown to drive selection; stopping it here
            // prevents the row's onSelect from firing when the user clicks
            // the trash button.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded text-ink-muted opacity-0 transition-opacity",
              "hover:bg-destructive/10 hover:text-destructive",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "group-hover:opacity-100 group-aria-selected:opacity-100",
            )}
          >
            <Trash2 className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Delete session</TooltipContent>
      </Tooltip>
    </CommandItem>
  );
}

// ---------------------------------------------------------------------------
// SessionHistoryList — public API
// ---------------------------------------------------------------------------

// Bucket boundaries are computed once per render against `now`. We pre-bucket
// the sessions so `cmdk` only filters by title — cmdk is the source of truth
// for search; we only re-group within each search result by recency.
export function SessionHistoryList({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
}: SessionHistoryListProps) {
  const groups = useMemo(() => groupByRecency(sessions), [sessions]);

  // Map every cmdk `value` (which must be unique per item) back to the title
  // we want to match against. cmdk dedupes items by value, so we encode the
  // session id into the value to keep them distinct, and use this map to
  // filter on the title only.
  const titleByValue = useMemo(() => {
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
                <SessionHistoryRow
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onSelect={() => onSelect(s.id)}
                  onDelete={() => onDelete(s.id)}
                />
              ))}
            </CommandGroup>
          ),
        )}
      </CommandList>
    </Command>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Prefix keeps the cmdk value distinct from any other Command consumer that
// might share the DOM.
function itemValue(sessionId: string): string {
  return `session:${sessionId}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Group sessions by `updatedAt` against fixed buckets. Calendar-day
// boundaries for "Today"/"Yesterday"; older buckets use elapsed-time so a
// 5-day-old session reads as "5 days ago" regardless of the time of day.
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
    const label = bucketLabel(t, startOfToday, startOfYesterday);
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
): string {
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";

  const days = Math.ceil((startOfToday - t) / DAY_MS);

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
