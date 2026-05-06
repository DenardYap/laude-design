"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import type { DesignDTO } from "@/lib/workspace/types";
import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import { FilesTab } from "@/components/workspace/canvas/files-tab";
import { DesignTab } from "@/components/workspace/canvas/design-tab";
import type { CanvasTabStripProps } from "@/components/workspace/canvas/types/canvas-tab-strip";

export function CanvasTabStrip({ projectId, designs }: CanvasTabStripProps) {
  const openTabs = useWorkspaceStore(
    (s) => s.openTabsByProject[projectId] ?? EMPTY_TAB_LIST,
  );
  const activeTab = useWorkspaceStore(
    (s) => s.activeTabByProject[projectId] ?? "files",
  );
  const hasHydrated = useWorkspaceStore((s) => s._hasHydrated);
  const setActive = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeDesignTab);
  const setTabOrder = useWorkspaceStore((s) => s.setDesignTabOrder);
  const ensureCanvasHydrated = useWorkspaceStore(
    (s) => s.ensureCanvasTabsHydrated,
  );

  // Before the Zustand persist middleware has finished reading localStorage,
  // suppress the active-tab highlight entirely. 
  const visibleActiveTab = hasHydrated ? activeTab : null;

  const designIds = useMemo(() => designs.map((d) => d.id), [designs]);

  // Reconcile persisted canvas-tab state against the current server-rendered
  // design list. Runs whenever the server data changes so any stale design IDs
  // (from deleted designs or a stale localStorage entry) are pruned.
  // NOTE: `activeTab` is intentionally NOT in the dep array.
  useEffect(() => {
    ensureCanvasHydrated(projectId, designIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, designIds, ensureCanvasHydrated]);

  const orderRef = useRef<string[]>([...openTabs]);
  const dragRef = useRef<{
    tabId: string;
    startX: number;
    naturalLeft: number;
  } | null>(null);
  const tabElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const filesTabRef = useRef<HTMLButtonElement>(null);

  const [renderOrder, setRenderOrder] =
    useState<readonly string[]>(openTabs);
  const [dragOffset, setDragOffset] = useState<{
    tabId: string;
    offset: number;
  } | null>(null);

  // Which tab (if any) is currently showing its rename input
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Keep orderRef and renderOrder in sync when the store changes and we're not dragging
  useEffect(() => {
    if (!dragRef.current) {
      orderRef.current = [...openTabs];
      setRenderOrder(openTabs);
    }
  }, [openTabs]);

  const designById = useMemo(() => {
    const map = new Map<string, DesignDTO>();
    for (const d of designs) map.set(d.id, d);
    return map;
  }, [designs]);

  const handleTabMouseDown = useCallback(
    (id: string, e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (dragRef.current) return;
      e.preventDefault();
      setRenamingId(null);

      const draggedEl = tabElsRef.current.get(id);
      const naturalLeft = draggedEl?.getBoundingClientRect().left ?? 0;
      dragRef.current = { tabId: id, startX: e.clientX, naturalLeft };
      setDragOffset({ tabId: id, offset: 0 });

      // Prevent text selection while dragging
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      const handleMouseMove = (ev: globalThis.MouseEvent) => {
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

  const registerTabEl = useCallback(
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
        active={visibleActiveTab === "files"}
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
            active={visibleActiveTab === `design:${id}`}
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
