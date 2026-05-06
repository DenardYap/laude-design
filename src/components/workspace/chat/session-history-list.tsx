"use client";

import { useMemo } from "react";
import { Check, MessageSquare, Trash2 } from "lucide-react";

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
import { useWorkspaceStore } from "@/stores/workspace-store";
import type {
  SessionHistoryListProps,
  SessionHistoryRowProps,
} from "@/components/workspace/chat/types/session";
import {
  itemValue,
  groupByRecency,
  __testing,
} from "@/components/workspace/chat/utils/session-history";

export { __testing };

function SessionHistoryRow({ session, projectId, isActive }: SessionHistoryRowProps) {
  const openSessionTab = useWorkspaceStore((s) => s.openSessionTab);
  const requestSessionDelete = useWorkspaceStore((s) => s.requestSessionDelete);
  const setHistoryOpen = useWorkspaceStore((s) => s.setSessionHistoryOpen);

  return (
    <CommandItem
      value={itemValue(session.id)}
      onSelect={() => {
        openSessionTab(projectId, session.id);
        setHistoryOpen(false);
      }}
      className="group gap-2 pr-1"
    >
      <MessageSquare className="size-3.5 shrink-0 text-ink-subtle" />
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setHistoryOpen(false);
              requestSessionDelete(session.id);
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

export function SessionHistoryList({ projectId, sessions }: SessionHistoryListProps) {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionByProject[projectId]);
  const groups = useMemo(() => groupByRecency(sessions), [sessions]);

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
                  projectId={projectId}
                  isActive={s.id === activeSessionId}
                />
              ))}
            </CommandGroup>
          ),
        )}
      </CommandList>
    </Command>
  );
}
