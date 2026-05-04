"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import { useWorkspaceStore } from "@/stores/workspace-store";

interface UseTabDragResult {
  renderOrder: readonly string[];
  dragOffset: { tabId: string; offset: number } | null;
  handleTabMouseDown: (id: string, e: ReactMouseEvent<HTMLDivElement>) => void;
  registerTabEl: (id: string) => (el: HTMLDivElement | null) => void;
}

/**
 * Manages drag-to-reorder state for a horizontal tab strip.
 * Mirrors the canvas tab strip pattern.
 *
 * Only real (non-optimistic) session ids participate in drag; optimistic
 * placeholder tabs stay pinned at the right edge and should not pass an
 * `onMouseDown` or `tabRef` to prevent them from entering a drag.
 */
export function useTabDrag(
  openSessionIds: readonly string[],
  projectId: string,
  scrollRef: RefObject<HTMLDivElement | null>,
): UseTabDragResult {
  const setTabOrder = useWorkspaceStore((s) => s.setSessionTabOrder);

  const orderRef = useRef<string[]>([...openSessionIds]);
  const dragRef = useRef<{
    tabId: string;
    startX: number;
    naturalLeft: number;
  } | null>(null);
  const tabElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [renderOrder, setRenderOrder] =
    useState<readonly string[]>(openSessionIds);
  const [dragOffset, setDragOffset] = useState<{
    tabId: string;
    offset: number;
  } | null>(null);

  // Sync the local render order with the store whenever the persisted open
  // list changes (open/close, hydration, drag commit). Skip while the user
  // is mid-drag so an in-flight swap isn't yanked back to the previous
  // committed order.
  useEffect(() => {
    if (!dragRef.current) {
      orderRef.current = [...openSessionIds];
      setRenderOrder(openSessionIds);
    }
  }, [openSessionIds]);

  const handleTabMouseDown = useCallback(
    (id: string, e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (dragRef.current) return;
      // Don't hijack interactive children — close button, rename input, etc.
      if ((e.target as HTMLElement).closest("input, button")) return;
      e.preventDefault();

      const draggedEl = tabElsRef.current.get(id);
      const naturalLeft = draggedEl?.getBoundingClientRect().left ?? 0;
      dragRef.current = { tabId: id, startX: e.clientX, naturalLeft };
      setDragOffset({ tabId: id, offset: 0 });

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      const handleMouseMove = (ev: globalThis.MouseEvent) => {
        if (!dragRef.current) return;
        const { tabId, startX, naturalLeft: nl } = dragRef.current;

        const order = orderRef.current;
        const idx = order.indexOf(tabId);
        if (idx === -1) return;
        const el = tabElsRef.current.get(tabId);
        if (!el) return;

        const draggedRect = el.getBoundingClientRect();
        const rawDelta = ev.clientX - startX;
        const draggedCenter = nl + draggedRect.width / 2 + rawDelta;

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
              dragRef.current.naturalLeft = prevRect.left;
              setDragOffset({ tabId, offset: 0 });
              setRenderOrder(newOrder);
              return;
            }
          }
        }

        // No swap — clamp so the ghost can't escape the strip.
        let visualDelta = rawDelta;
        const stripRect = scrollRef.current?.getBoundingClientRect();
        if (stripRect) {
          const minDelta = stripRect.left - nl;
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
    [projectId, scrollRef, setTabOrder],
  );

  const registerTabEl = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) tabElsRef.current.set(id, el);
      else tabElsRef.current.delete(id);
    },
    [],
  );

  return { renderOrder, dragOffset, handleTabMouseDown, registerTabEl };
}
