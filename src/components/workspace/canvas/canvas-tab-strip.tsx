"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Folder, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DesignDTO } from "@/lib/workspace/types";
import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import { deleteDesign, renameDesign } from "@/server/actions/designs";

interface CanvasTabStripProps {
  projectId: string;
  designs: DesignDTO[];
}

export function CanvasTabStrip({ projectId, designs }: CanvasTabStripProps) {
  const openTabs = useWorkspaceStore(
    (s) => s.openTabsByProject[projectId] ?? EMPTY_TAB_LIST,
  );
  const activeTab = useWorkspaceStore(
    (s) => s.activeTabByProject[projectId] ?? "files",
  );
  const setActive = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeDesignTab);
  const setTabOrder = useWorkspaceStore((s) => s.setDesignTabOrder);

  // Mutable drag state — kept in refs so mousemove handlers are never stale
  const orderRef = React.useRef<string[]>([...openTabs]);
  // naturalLeft = tab's left edge with transform:none (updated at drag start and after each swap)
  const dragRef = React.useRef<{
    tabId: string;
    startX: number;
    naturalLeft: number;
  } | null>(null);
  const tabElsRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const filesTabRef = React.useRef<HTMLButtonElement>(null);

  // Rendered order (triggers re-render on swap) + per-tab offset for the ghost
  const [renderOrder, setRenderOrder] =
    React.useState<readonly string[]>(openTabs);
  const [dragOffset, setDragOffset] = React.useState<{
    tabId: string;
    offset: number;
  } | null>(null);

  // Which tab (if any) is currently showing its rename input
  const [renamingId, setRenamingId] = React.useState<string | null>(null);

  // Keep orderRef and renderOrder in sync when the store changes and we're not dragging
  React.useEffect(() => {
    if (!dragRef.current) {
      orderRef.current = [...openTabs];
      setRenderOrder(openTabs);
    }
  }, [openTabs]);

  const designById = React.useMemo(() => {
    const map = new Map<string, DesignDTO>();
    for (const d of designs) map.set(d.id, d);
    return map;
  }, [designs]);

  const handleTabMouseDown = React.useCallback(
    (id: string, e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // Guard: ignore if a drag is already in progress (prevents stacked listeners)
      if (dragRef.current) return;
      e.preventDefault();

      // Cancel any open rename input so tab widths are stable before measuring
      setRenamingId(null);

      const draggedEl = tabElsRef.current.get(id);
      const naturalLeft = draggedEl?.getBoundingClientRect().left ?? 0;
      dragRef.current = { tabId: id, startX: e.clientX, naturalLeft };
      setDragOffset({ tabId: id, offset: 0 });

      // Prevent text selection while dragging
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const { tabId, startX, naturalLeft } = dragRef.current;

        const order = orderRef.current;
        const idx = order.indexOf(tabId);
        const draggedEl = tabElsRef.current.get(tabId);
        if (!draggedEl) return;

        const draggedRect = draggedEl.getBoundingClientRect();
        const rawDelta = ev.clientX - startX;
        // Use naturalLeft (not draggedRect.left) so the center is transform-free.
        const draggedCenter = naturalLeft + draggedRect.width / 2 + rawDelta;

        if (rawDelta > 0 && idx < order.length - 1) {
          const nextId = order[idx + 1];
          const nextEl = tabElsRef.current.get(nextId);
          if (nextEl) {
            const nextRect = nextEl.getBoundingClientRect();
            if (draggedCenter > nextRect.left + nextRect.width / 2) {
              const newOrder = [...order];
              newOrder[idx] = nextId;
              newOrder[idx + 1] = tabId;
              orderRef.current = newOrder;
              dragRef.current.startX = ev.clientX;
              // nextEl has no transform, so its left IS the new natural slot position.
              dragRef.current.naturalLeft = nextRect.left;
              setDragOffset({ tabId, offset: 0 });
              setRenderOrder(newOrder);
              return;
            }
          }
        } else if (rawDelta < 0 && idx > 0) {
          const prevId = order[idx - 1];
          const prevEl = tabElsRef.current.get(prevId);
          if (prevEl) {
            const prevRect = prevEl.getBoundingClientRect();
            if (draggedCenter < prevRect.left + prevRect.width / 2) {
              const newOrder = [...order];
              newOrder[idx] = prevId;
              newOrder[idx - 1] = tabId;
              orderRef.current = newOrder;
              dragRef.current.startX = ev.clientX;
              // prevEl has no transform, so its left IS the new natural slot position.
              dragRef.current.naturalLeft = prevRect.left;
              setDragOffset({ tabId, offset: 0 });
              setRenderOrder(newOrder);
              return;
            }
          }
        }

        // No swap — clamp visual offset at the strip's hard edges.
        // Left: use naturalLeft (transform-free baseline) so the clamp doesn't
        //       oscillate as the transform itself shifts draggedRect.left each frame.
        // Right: last tab (no right neighbour) stays put.
        let visualDelta = rawDelta;
        const filesRect = filesTabRef.current?.getBoundingClientRect();
        if (filesRect) {
          const minDelta = filesRect.right - naturalLeft;
          visualDelta = Math.max(minDelta, visualDelta);
        }
        if (idx === order.length - 1) {
          visualDelta = Math.min(0, visualDelta);
        }
        setDragOffset({ tabId, offset: visualDelta });
      };

      const handleMouseUp = () => {
        if (dragRef.current) {
          setTabOrder(projectId, orderRef.current);
        }
        dragRef.current = null;
        setDragOffset(null);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [projectId, setTabOrder],
  );

  const registerTabEl = React.useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) tabElsRef.current.set(id, el);
      else tabElsRef.current.delete(id);
    },
    [],
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto ">
      <FilesTab
        ref={filesTabRef}
        active={activeTab === "files"}
        onClick={() => setActive(projectId, "files")}
      />
      {renderOrder.map((id) => {
        const design = designById.get(id);
        if (!design) return null;
        const isDragging = dragOffset?.tabId === id;
        return (
          <DesignTab
            key={id}
            design={design}
            active={activeTab === `design:${id}`}
            renaming={renamingId === id}
            onRenameChange={(v) => setRenamingId(v ? id : null)}
            isDragging={isDragging}
            dragOffset={isDragging ? (dragOffset?.offset ?? 0) : 0}
            tabRef={registerTabEl(id)}
            onSelect={() => setActive(projectId, `design:${id}`)}
            onClose={() => closeTab(projectId, id)}
            onMouseDown={(e) => handleTabMouseDown(id, e)}
          />
        );
      })}
    </div>
  );
}

const TAB_BASE =
  "group inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors";
const TAB_ACTIVE = "border-border bg-canvas text-ink shadow-sm";
const TAB_INACTIVE =
  "border-transparent text-ink-muted hover:bg-surface-sunken/60 hover:text-ink";

function FilesTab({
  ref,
  active,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(TAB_BASE, "ml-2", active ? TAB_ACTIVE : TAB_INACTIVE)}
    >
      <Folder className="size-3.5" />
      Files
    </button>
  );
}

interface DesignTabProps {
  design: DesignDTO;
  active: boolean;
  renaming: boolean;
  onRenameChange: (renaming: boolean) => void;
  isDragging: boolean;
  dragOffset: number;
  tabRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

function DesignTab({
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
  const [draft, setDraft] = React.useState(design.name);

  // Keep draft in sync when the design name changes externally
  React.useEffect(() => {
    if (!renaming) setDraft(design.name);
  }, [design.name, renaming]);

  const rename = useMutation({
    mutationFn: (name: string) => renameDesign(design.id, name),
    onSuccess: () => {
      onRenameChange(false);
      router.refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to rename"),
  });

  const remove = useMutation({
    mutationFn: () => deleteDesign(design.id),
    onSuccess: () => {
      onClose();
      router.refresh();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to delete"),
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
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => rename.mutate(draft)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") rename.mutate(draft);
                if (e.key === "Escape") {
                  setDraft(design.name);
                  onRenameChange(false);
                }
              }}
              className="w-28 bg-transparent text-xs outline-none"
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
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onRenameChange(true)}>
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
