"use client";

import { useRef, useState } from 'react';
import { X } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useRenameSession } from "@/components/workspace/chat/hooks/use-rename-session";
import type { SessionTabProps } from "@/components/workspace/chat/types/session";

export type { SessionTabProps };

export function SessionTab({
  session,
  projectId,
  active,
  onSelect,
  isPending,
  isDragging = false,
  dragOffset = 0,
  tabRef,
  onMouseDown,
}: SessionTabProps) {
  const [renaming, setRenaming] = useState(false);
  const renameTriggeredRef = useRef(false);
  const isStreaming = useWorkspaceStore(
    (s) => Boolean(s.streamingSessionIds[session.id]),
  );
  const closeOrConfirmTab = useWorkspaceStore((s) => s.closeOrConfirmSessionTab);
  const requestDelete = useWorkspaceStore((s) => s.requestSessionDelete);

  const rename = useRenameSession(session, { onSuccess: () => setRenaming(false) });

  const tabClasses = cn(
    "group inline-flex h-7 max-w-[160px] shrink-0 cursor-pointer items-center gap-1 rounded-md pl-2 pr-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    !isPending && "cursor-grab select-none",
    active
      ? "bg-surface-sunken text-ink"
      : "text-ink-muted hover:bg-surface-sunken/60 hover:text-ink",
    isDragging && "opacity-90 scale-[1.03]",
  );

  // Optimistic placeholder tabs are non-interactive beyond selection — they
  // can't be renamed or closed until the server has assigned a real ID.
  if (isPending) {
    return (
      <button
        type="button"
        onClick={onSelect}
        data-session-id={session.id}
        className={cn(tabClasses, "pr-2")}
      >
        <span className="truncate">{session.title}</span>
      </button>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={tabRef}
          role="button"
          tabIndex={0}
          data-session-id={session.id}
          onClick={onSelect}
          onDoubleClick={() => setRenaming(true)}
          onMouseDown={onMouseDown}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          style={
            isDragging
              ? {
                  transform: `translateX(${dragOffset}px)`,
                  zIndex: 50,
                  position: "relative",
                }
              : undefined
          }
          className={tabClasses}
        >
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label="Laude is working"
                  className="relative inline-flex size-1.5 shrink-0 items-center justify-center"
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Laude is working</TooltipContent>
            </Tooltip>
          ) : null}
          {renaming ? (
            <InlineRenameInput
              size="xs"
              variant="raised"
              initialValue={session.title}
              onCommit={(v) => {
                const trimmed = v.trim().slice(0, 80) || "Untitled";
                if (trimmed === session.title) {
                  setRenaming(false);
                  return;
                }
                rename.mutate(v);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="truncate">{session.title}</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeOrConfirmTab(projectId, session.id);
            }}
            aria-label={`Close ${session.title}`}
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded transition-opacity hover:bg-border",
              active
                ? "opacity-60 hover:opacity-100"
                : "opacity-0 group-hover:opacity-60 hover:opacity-100",
            )}
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => {
          if (renameTriggeredRef.current) {
            e.preventDefault();
            renameTriggeredRef.current = false;
          }
        }}
      >
        <ContextMenuItem
          onSelect={() => {
            renameTriggeredRef.current = true;
            setRenaming(true);
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => closeOrConfirmTab(projectId, session.id)}>
          <X className="size-3.5" />
          Close tab
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => requestDelete(session.id)}
        >
          Delete session
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
