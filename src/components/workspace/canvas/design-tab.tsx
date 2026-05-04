"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui";
import { InlineRenameInput } from "@/components/shared/inline-rename-input";
import { cn } from "@/lib/utils";
import type { DesignDTO } from "@/lib/workspace/types";
import { useOptimisticFilesStore } from "@/stores/optimistic-files-store";
import { deleteDesign, renameDesign } from "@/server/actions/designs";
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
  const router = useRouter();
  const renameTriggeredRef = useRef(false);

  const setDesignRename = useOptimisticFilesStore((s) => s.setDesignRename);
  const clearDesignRename = useOptimisticFilesStore(
    (s) => s.clearDesignRename,
  );
  const markDesignDeleted = useOptimisticFilesStore(
    (s) => s.markDesignDeleted,
  );
  const unmarkDesignDeleted = useOptimisticFilesStore(
    (s) => s.unmarkDesignDeleted,
  );

  const rename = useMutation({
    mutationFn: async (name: string) => {
      const next = name.trim() || "Untitled";
      await renameDesign(design.id, name);
      return next;
    },
    onMutate: (name) => {
      const next = name.trim() || "Untitled";
      setDesignRename(design.id, next);
      onRenameChange(false);
    },
    onSuccess: (newName) => {
      toast.success(`Renamed design to "${newName}"`);
      router.refresh();
    },
    onError: (e) => {
      clearDesignRename(design.id);
      toast.error(e instanceof Error ? e.message : "Failed to rename");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      await deleteDesign(design.id);
      return design.name;
    },
    onMutate: () => {
      markDesignDeleted(design.id);
      onClose();
    },
    onSuccess: (name) => {
      toast.success(`Deleted "${name}"`);
      router.refresh();
    },
    onError: (e) => {
      unmarkDesignDeleted(design.id);
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    },
  });

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
