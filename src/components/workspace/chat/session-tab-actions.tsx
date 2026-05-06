"use client";

import { History, Plus } from "lucide-react";

import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { SessionHistoryList } from "@/components/workspace/chat/session-history-list";
import type { SessionTabActionsProps } from "@/components/workspace/chat/types/session";

export function SessionTabActions({ projectId, sessions, onNew }: SessionTabActionsProps) {
  const historyOpen = useWorkspaceStore((s) => s.sessionHistoryOpen);
  const setHistoryOpen = useWorkspaceStore((s) => s.setSessionHistoryOpen);

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-surface-sunken">
      <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <IconButton
                aria-label="Session history"
                className="size-7 shrink-0 hover:bg-border"
                icon={<History className="size-3.5" />}
              />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">All sessions</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
          <SessionHistoryList projectId={projectId} sessions={sessions} />
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New session"
            className="size-7 shrink-0 hover:bg-border"
            icon={<Plus className="size-3.5" />}
            onClick={onNew}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New session</TooltipContent>
      </Tooltip>
    </div>
  );
}
