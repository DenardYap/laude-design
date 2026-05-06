"use client";

import { useEffect, useMemo, useRef } from "react";

import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import { SessionTab } from "@/components/workspace/chat/session-tab";
import { useTabDrag } from "@/components/workspace/chat/hooks/use-tab-drag";
import { useScrollEdges } from "@/components/workspace/chat/hooks/use-scroll-edges";
import { TEMP_SESSION_PREFIX } from "@/components/workspace/chat/utils/session-constants";
import type { ChatSessionDTO } from "@/lib/workspace/types";
import type { SessionTabStripProps } from "@/components/workspace/chat/types/session";

const FADE = 28;

export function SessionTabStrip({ projectId, sessionsById }: SessionTabStripProps) {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionByProject[projectId]);
  const openSessionIds = useWorkspaceStore(
    (s) => s.openSessionsByProject[projectId] ?? EMPTY_TAB_LIST,
  );
  const titleOverrides = useWorkspaceStore((s) => s.sessionTitleOverrides);
  const setActive = useWorkspaceStore((s) => s.setActiveSession);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { renderOrder, dragOffset, handleTabMouseDown, registerTabEl } = useTabDrag(
    openSessionIds,
    projectId,
    scrollRef,
  );

  const displaySessions = useMemo(() => {
    return renderOrder
      .map((id) => sessionsById.get(id))
      .filter((s): s is ChatSessionDTO => Boolean(s))
      .map((s) => {
        const override = titleOverrides[s.id];
        return override ? { ...s, title: override } : s;
      });
  }, [renderOrder, sessionsById, titleOverrides]);

  // Keep the active tab in view when the active session changes.
  useEffect(() => {
    if (!activeSessionId) return;
    const el = scrollRef.current;
    if (!el) return;
    el
      .querySelector<HTMLElement>(`[data-session-id="${CSS.escape(activeSessionId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSessionId, displaySessions.length]);

  // Convert vertical scroll to horizontal for non-trackpad users.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX === 0 && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const edges = useScrollEdges(scrollRef, [displaySessions.length]);
  const maskImage = `linear-gradient(to right, transparent 0, black ${
    edges.left ? FADE : 0
  }px, black calc(100% - ${edges.right ? FADE : 0}px), transparent 100%)`;

  return (
    <div
      ref={scrollRef}
      className="scrollbar-hide flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
      style={{ maskImage, WebkitMaskImage: maskImage }}
    >
      {displaySessions.map((s) => {
        const isPending = s.id.startsWith(TEMP_SESSION_PREFIX);
        const isDragging = dragOffset?.tabId === s.id;
        return (
          <SessionTab
            key={s.id}
            session={s}
            projectId={projectId}
            active={s.id === activeSessionId}
            onSelect={() => setActive(projectId, s.id)}
            isPending={isPending}
            isDragging={isDragging}
            dragOffset={isDragging ? (dragOffset?.offset ?? 0) : 0}
            tabRef={isPending ? undefined : registerTabEl(s.id)}
            onMouseDown={isPending ? undefined : (e) => handleTabMouseDown(s.id, e)}
          />
        );
      })}
    </div>
  );
}
