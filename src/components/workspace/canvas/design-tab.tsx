"use client";

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Pencil, X } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui";
import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import { cn } from "@/lib/utils";
import type { DesignDTO } from "@/lib/workspace/types";
import { useRenameDesign, useDeleteDesign } from "@/components/workspace/canvas/hooks/use-design-mutations";
import { TAB_BASE, TAB_ACTIVE, TAB_INACTIVE } from "@/components/workspace/canvas/utils/tab-styles";
import type { DesignTabProps } from "@/components/workspace/canvas/types/canvas-tab-strip";

export function DesignTab({
  design,
  active,
  renaming,
  onRenameChange,
  isDragging,
  dragOffset,
  tabRef,
  onSelect,
  onClose,
  onMouseDown,
}: DesignTabProps) {
  const renameTriggeredRef = useRef(false);

  const rename = useRenameDesign(design, { onBeforeCommit: () => onRenameChange(false) });
  const remove = useDeleteDesign(design, { onBeforeDelete: onClose });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={tabRef}
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onDoubleClick={() => onRenameChange(true)}
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
          className={cn(
            TAB_BASE,
            "max-w-[180px] cursor-grab select-none",
            active ? TAB_ACTIVE : TAB_INACTIVE,
            isDragging && "opacity-90 scale-[1.03]",
          )}
        >
          {renaming ? (
            <InlineRenameInput
              size="xs"
              variant="raised"
              initialValue={design.name}
              onCommit={(v) => {
                const trimmed = v.trim() || "Untitled";
                if (trimmed === design.name) {
                  onRenameChange(false);
                  return;
                }
                rename.mutate(v);
              }}
              onCancel={() => onRenameChange(false)}
            />
          ) : (
            <span className="truncate">{design.name}</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRenameChange(true);
            }}
            className="opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
            aria-label={`Rename ${design.name}`}
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="opacity-60 transition-opacity hover:opacity-100"
            aria-label={`Close ${design.name}`}
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
            onRenameChange(true);
          }}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={onClose}>Close tab</ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => remove.mutate()}
        >
          Delete design
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
